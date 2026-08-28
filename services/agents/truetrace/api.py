"""HTTP API for the TrueTrace web app.

Pipeline stages run on a background thread so submission returns immediately -
the PRD requires that analysis never blocks the UI. Pub/Sub replaces the thread
when this moves to Cloud Run; the stage functions do not change.
"""
from __future__ import annotations

import base64
import logging
import os
import shutil
import tempfile
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .adapters.fetcher import FallbackFetcher
from .adapters.store import JsonCaseStore
from .core.crypto import EvidenceKeyError, generate_key, load_key
from .core.detector_client import DetectorClient
from .core.evidence import build_manifest, build_package, chain_entry
from .core.frames import sample_frames
from .core.hashing import sha256_file
from .reporting.drafter import ReportInput, draft

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("api")

app = FastAPI(title="TrueTrace API", version="0.1.0")

# The frontend is a static export served from a different origin in dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

store = JsonCaseStore(os.getenv("CASE_STORE", "data/cases"))
detector = DetectorClient(os.getenv("DETECTOR_URL", "http://127.0.0.1:8081"))

try:
    EVIDENCE_KEY = load_key()
except EvidenceKeyError:
    # Never refuse to start: a demo that will not boot is worse than one that
    # warns. Packages remain real, just unreadable after this process exits.
    EVIDENCE_KEY = load_key(generate_key())
    log.warning("EVIDENCE_KEY unset - using an EPHEMERAL key for this process")


class CreateCase(BaseModel):
    url: str
    depicts_reporter: bool = True
    consent_given: bool = False
    is_intimate: bool = True
    jurisdiction: str = "US"
    reporter_name: str | None = None
    reporter_contact: str | None = None
    extra_context: str | None = None
    owner: str = Field(default="anonymous", description="pseudonymous client id")


@app.get("/healthz")
def healthz() -> dict:
    try:
        det = detector.health()
    except Exception as exc:
        det = {"status": "unreachable", "error": str(exc)}
    return {"status": "ok", "detector": det}


@app.post("/cases", status_code=202)
def create_case(body: CreateCase, background: BackgroundTasks) -> dict:
    case_id = f"case-{uuid.uuid4().hex[:12]}"
    store.create(
        {
            "case_id": case_id,
            "owner": body.owner,
            "status": "queued",
            "source_url": body.url,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "intake": body.model_dump(),
            "analysis": None,
            "evidence": None,
            "preview_b64": None,
            "error": None,
        }
    )
    store.append_audit(case_id, "created", body.url)
    background.add_task(_run_pipeline, case_id)
    return {"case_id": case_id, "status": "queued"}


@app.get("/cases/{case_id}")
def get_case(case_id: str) -> dict:
    case = store.get(case_id)
    if case is None:
        raise HTTPException(404, "case not found")
    return case


@app.get("/cases/{case_id}/report")
def get_report(case_id: str) -> dict:
    case = store.get(case_id)
    if case is None:
        raise HTTPException(404, "case not found")
    if case.get("status") != "complete":
        raise HTTPException(409, "analysis is not finished")

    intake = case["intake"]
    ev = case["evidence"]
    report = draft(
        ReportInput(
            case_id=case_id,
            source_url=case["source_url"],
            fetched_at=datetime.fromisoformat(ev["fetched_at"]),
            video_sha256=ev["video_sha256"],
            manifest_sha256=ev["manifest_sha256"],
            reporter_name=intake.get("reporter_name"),
            reporter_contact=intake.get("reporter_contact"),
            depicts_reporter=intake["depicts_reporter"],
            consent_given=intake["consent_given"],
            is_intimate=intake["is_intimate"],
            jurisdiction=intake.get("jurisdiction", "US"),
            analysis=case.get("analysis"),
            extra_context=intake.get("extra_context"),
        )
    )
    store.append_audit(case_id, "report_drafted", report.platform.key if report.platform else "generic")
    return {
        "platform": report.platform.display_name if report.platform else None,
        "subject": report.subject,
        "body": report.body,
        "routes": [{"name": r.name, "url": r.url, "note": r.note} for r in report.routes],
        "checklist": report.checklist,
        "warnings": report.warnings,
    }


def _run_pipeline(case_id: str) -> None:
    case = store.get(case_id)
    if case is None:
        return
    workdir = Path(tempfile.mkdtemp(prefix="truetrace_"))
    try:
        store.update(case_id, {"status": "fetching"})
        result = FallbackFetcher().fetch(case["source_url"], workdir)
        if not result.ok:
            store.update(case_id, {"status": "failed", "error": result.degraded})
            store.append_audit(case_id, "fetch_failed", result.degraded or "")
            return
        store.append_audit(case_id, "fetched", result.metadata.get("title") or "")

        store.update(case_id, {"status": "hashing"})
        digest = sha256_file(result.video_path)
        store.append_audit(case_id, "hashed", digest)

        store.update(case_id, {"status": "sampling"})
        frames = sample_frames(result.video_path, count=int(os.getenv("FRAME_SAMPLE_COUNT", "16")))
        if not frames:
            store.update(case_id, {"status": "failed", "error": "no decodable frames"})
            return

        store.update(case_id, {"status": "screening"})
        analysis = detector.score(frames)
        store.append_audit(case_id, "screened", analysis.get("band", ""))

        store.update(case_id, {"status": "sealing"})
        named = [(f"frame_{f.index:03d}.jpg", f.jpeg) for f in frames]
        manifest = build_manifest(
            case_id=case_id,
            source_url=result.source_url,
            fetched_at=result.fetched_at,
            video_sha256=digest,
            source_metadata=result.metadata,
            analysis=analysis,
            frames=named,
            degraded=result.degraded,
        )
        pkg = build_package(
            case_id=case_id,
            manifest=manifest,
            analysis=analysis,
            frames=named,
            chain=[
                chain_entry("fetched", result.source_url),
                chain_entry("hashed", digest),
                chain_entry("sampled", f"{len(frames)} frames"),
                chain_entry("screened", str(analysis.get("band"))),
                chain_entry("sealed", case_id),
            ],
            ttl_days=int(os.getenv("EVIDENCE_TTL_DAYS", "7")),
            key=EVIDENCE_KEY,
        )
        out_dir = Path(os.getenv("EVIDENCE_DIR", "data/evidence"))
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / f"{case_id}.ttz").write_bytes(pkg.blob)
        (out_dir / f"{case_id}.sha256").write_text(pkg.manifest_sha256, encoding="utf-8")

        # A single preview frame so the user can confirm this is the right
        # content WITHOUT the source video ever being played back. The UI blurs
        # it by default and requires an explicit action to reveal.
        preview = base64.b64encode(frames[0].jpeg).decode()

        store.update(
            case_id,
            {
                "status": "complete",
                "analysis": analysis,
                "preview_b64": preview,
                "source_metadata": result.metadata,
                "evidence": {
                    "path": str(out_dir / f"{case_id}.ttz"),
                    "size_bytes": len(pkg.blob),
                    "manifest_sha256": pkg.manifest_sha256,
                    "video_sha256": digest,
                    "fetched_at": result.fetched_at.isoformat(),
                    "sealed_at": pkg.sealed_at.isoformat(),
                    "expires_at": pkg.expires_at.isoformat(),
                    "frame_count": len(named),
                },
            },
        )
        store.append_audit(case_id, "sealed", pkg.manifest_sha256)
        log.info("case %s complete (%s)", case_id, analysis.get("band"))
    except Exception as exc:
        log.exception("pipeline failed for %s", case_id)
        store.update(case_id, {"status": "failed", "error": str(exc)})
        store.append_audit(case_id, "failed", str(exc))
    finally:
        # The raw video is the most sensitive artifact here. It is never
        # persisted and never uploaded.
        shutil.rmtree(workdir, ignore_errors=True)
