"""Assembling the evidence package.

The package has to answer one question for someone who was not present when it
was made: "what exactly was analysed, when, and by what?" Everything here exists
to make that answerable without trusting us - hashes over the video, over each
frame, and over the manifest itself.
"""
from __future__ import annotations

import io
import json
import zipfile
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .crypto import seal
from .hashing import sha256_bytes

TOOL_VERSION = "truetrace/0.1.0"
MANIFEST_NAME = "manifest.json"


@dataclass(frozen=True)
class EvidencePackage:
    case_id: str
    blob: bytes            # encrypted, ready to store
    manifest: dict
    manifest_sha256: str
    zip_sha256: str
    sealed_at: datetime
    expires_at: datetime


def build_manifest(
    *,
    case_id: str,
    source_url: str,
    fetched_at: datetime,
    video_sha256: str,
    source_metadata: dict,
    analysis: dict,
    frames: list[tuple[str, bytes]],
    degraded: str | None = None,
) -> dict:
    """The manifest is the evidentiary core. Frame hashes are listed individually
    so a single altered frame is detectable, not just a changed archive."""
    return {
        "schema": "truetrace.evidence/1",
        "tool_version": TOOL_VERSION,
        "case_id": case_id,
        "source": {
            "url": source_url,
            "fetched_at_utc": fetched_at.astimezone(timezone.utc).isoformat(),
            "video_sha256": video_sha256,
            "degraded": degraded,
            "metadata": source_metadata,
        },
        "analysis": {
            "model_version": analysis.get("model_version"),
            "band": analysis.get("band"),
            "score": analysis.get("score"),
            "frames_submitted": analysis.get("frames_submitted"),
            "frames_scored": analysis.get("frames_scored"),
            "dispersion": analysis.get("dispersion"),
            "limitations": analysis.get("limitations", []),
            "per_frame": analysis.get("frames", []),
        },
        "frames": [
            {"name": name, "sha256": sha256_bytes(data)} for name, data in frames
        ],
        "notice": (
            "This package records an automated analysis. The risk band is a "
            "statistical estimate, not a determination that the source video is "
            "or is not manipulated."
        ),
    }


def build_package(
    *,
    case_id: str,
    manifest: dict,
    analysis: dict,
    frames: list[tuple[str, bytes]],
    chain: list[str],
    ttl_days: int = 7,
    key: bytes | None = None,
) -> EvidencePackage:
    manifest_bytes = json.dumps(manifest, indent=2, sort_keys=True).encode("utf-8")
    manifest_sha = sha256_bytes(manifest_bytes)

    now = datetime.now(timezone.utc)
    buf = io.BytesIO()
    # Fixed timestamps inside the zip so the archive hash depends on content
    # only - two packages of the same evidence should not differ by clock skew.
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        def add(name: str, data: bytes) -> None:
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, data)

        add(MANIFEST_NAME, manifest_bytes)
        add("analysis.json", json.dumps(analysis, indent=2, sort_keys=True).encode("utf-8"))
        add("chain.log", ("\n".join(chain) + "\n").encode("utf-8"))
        for name, data in frames:
            add(f"frames/{name}", data)

    raw_zip = buf.getvalue()
    sealed = seal(raw_zip, manifest_sha, key)

    return EvidencePackage(
        case_id=case_id,
        blob=sealed.blob,
        manifest=manifest,
        manifest_sha256=manifest_sha,
        zip_sha256=sha256_bytes(raw_zip),
        sealed_at=now,
        expires_at=now + timedelta(days=ttl_days),
    )


def chain_entry(action: str, detail: str = "") -> str:
    ts = datetime.now(timezone.utc).isoformat()
    return f"{ts}\t{action}\t{detail}".rstrip()
