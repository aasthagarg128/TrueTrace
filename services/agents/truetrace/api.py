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
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from .adapters.fetcher import FallbackFetcher
from .adapters import JsonUserStore, build_case_store
from .adapters.mailer import build_mailer
from .core.auth import (
    AuthError,
    hash_password,
    issue_reset_token,
    issue_token,
    normalise_email,
    peek_token_subject,
    validate_email,
    validate_password,
    validate_username,
    verify_password,
    verify_reset_token,
    verify_token,
)
from .core.crypto import EvidenceKeyError, generate_key, load_key
from .core.google_auth import (
    GoogleAuthError,
    client_id as google_client_id,
    is_configured as google_configured,
    verify_credential as verify_google_credential,
)
from .core.detector_client import DetectorClient
from .core.evidence import build_manifest, build_package, chain_entry
from .core.explain import explain as gemini_explain, is_configured as gemini_configured
from .core.frames import sample_frames
from .core.hashing import sha256_file
from .core.retention import sweep as sweep_expired_evidence
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

store = build_case_store()
users = JsonUserStore(os.getenv("USER_STORE", "data/users"))
mailer = build_mailer()

EVIDENCE_DIR = os.getenv("EVIDENCE_DIR", "data/evidence")
# How often expired packages are swept. Hourly is plenty for a 7-day TTL and
# keeps the window between "expired" and "actually gone" small enough that the
# promise on the privacy page is honest.
RETENTION_INTERVAL_SECONDS = int(os.getenv("RETENTION_INTERVAL_SECONDS", str(60 * 60)))


def _retention_loop() -> None:
    """Sweep on startup, then on a timer.

    A daemon thread rather than a scheduler: it adds no dependency, dies with
    the process, and on Cloud Storage this is replaced by a bucket lifecycle
    rule anyway. A failure here is logged and retried next tick — retention
    must never take the API down.
    """
    while True:
        try:
            sweep_expired_evidence(store, EVIDENCE_DIR)
        except Exception:
            log.exception("retention sweep failed; will retry")
        time.sleep(RETENTION_INTERVAL_SECONDS)


@app.on_event("startup")
def _start_retention() -> None:
    threading.Thread(target=_retention_loop, name="retention", daemon=True).start()
    log.info("retention sweep every %ss", RETENTION_INTERVAL_SECONDS)

# Compared against when a username does not exist, so login timing does not
# reveal whether the account is real.
_DUMMY_HASH = hash_password("truetrace-nonexistent-account-placeholder")
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


@app.get("/healthz")
def healthz() -> dict:
    try:
        det = detector.health()
    except Exception as exc:
        det = {"status": "unreachable", "error": str(exc)}
    return {
        "status": "ok",
        "detector": det,
        "gemini_enabled": gemini_configured(),
    }



class Credentials(BaseModel):
    username: str
    password: str
    # Optional. Present only when the person chose the recoverable path.
    email: str | None = None


class ForgotRequest(BaseModel):
    email: str


class ResetRequest(BaseModel):
    token: str
    password: str


class GoogleCredential(BaseModel):
    credential: str  # the ID token issued by Google Identity Services


def current_user(authorization: str | None = Header(default=None)) -> dict:
    """Resolve the bearer token to a user, or 401.

    Every case route depends on this. There is no anonymous path into case data:
    a case belongs to exactly one account and is unreachable without its token.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "not signed in")
    try:
        user_id = verify_token(authorization.split(" ", 1)[1].strip())
    except AuthError as exc:
        raise HTTPException(401, str(exc)) from exc
    user = users.get_by_id(user_id)
    if user is None:
        raise HTTPException(401, "not signed in")
    return user


def _public(user: dict) -> dict:
    """Never return the password hash, not even to its owner."""
    return {
        "user_id": user["user_id"],
        "username": user["username"],
        "created_at": user["created_at"],
        "auth_provider": user.get("auth_provider", "password"),
        "email": user.get("email"),
        "recoverable": bool(user.get("email")),
    }


@app.post("/auth/signup", status_code=201)
def signup(body: Credentials) -> dict:
    email = normalise_email(body.email) if body.email else None
    try:
        validate_username(body.username)
        validate_password(body.password)
        if email:
            validate_email(email)
    except AuthError as exc:
        raise HTTPException(400, str(exc)) from exc

    if email and users.email_taken(email):
        raise HTTPException(409, "An account already uses that email address.")
    if users.exists(body.username):
        # Signup unavoidably reveals that a handle is taken - there is no way to
        # register otherwise. Login does NOT leak this; see below.
        raise HTTPException(409, "That username is already taken.")

    user = users.create(body.username, hash_password(body.password), email=email)
    log.info("account created %s (recovery: %s)", user["user_id"], "email" if email else "none")
    return {"token": issue_token(user["user_id"]), "user": _public(user)}


@app.post("/auth/login")
def login(body: Credentials) -> dict:
    user = users.get_by_username(body.username)
    # Verify against a dummy hash when the user does not exist, so a wrong
    # username and a wrong password take the same time and return the same
    # error. Confirming that a handle exists is itself a leak here.
    stored = user["password_hash"] if user else _DUMMY_HASH
    ok = verify_password(body.password, stored)
    if not user or not ok:
        raise HTTPException(401, "Incorrect username or password.")
    return {"token": issue_token(user["user_id"]), "user": _public(user)}



@app.post("/auth/forgot")
def forgot_password(body: ForgotRequest) -> dict:
    """Start a password reset.

    Always returns the same success response, whether or not the address is
    registered. Anything else turns this endpoint into a way to test which
    email addresses have TrueTrace accounts, which for this product is exactly
    the fact that must not leak.
    """
    email = normalise_email(body.email)
    user = users.get_by_email(email) if email else None

    if user and user.get("password_hash"):
        token = issue_reset_token(user["user_id"], user["password_hash"])
        base = os.getenv("APP_BASE_URL", "http://localhost:3000").rstrip("/")
        try:
            mailer.send_reset(email, f"{base}/reset?token={token}")
        except Exception:
            # Never let a mail failure change the response shape; that would
            # reveal which addresses exist just as clearly as a 404.
            log.exception("reset email could not be sent")

    return {
        "sent": True,
        "detail": "If that address has an account, a reset link is on its way.",
    }


@app.post("/auth/reset")
def reset_password(body: ResetRequest) -> dict:
    """Complete a reset. The token is verified against the CURRENT password
    hash, so it works once and dies the moment the password changes."""
    try:
        validate_password(body.password)
    except AuthError as exc:
        raise HTTPException(400, str(exc)) from exc

    # The claimed id is needed to find the account whose hash verifies the
    # signature. It is untrusted until verify_reset_token succeeds below.
    candidate = peek_token_subject(body.token)
    user = users.get_by_id(str(candidate)) if candidate else None
    if user is None or not user.get("password_hash"):
        raise HTTPException(400, "This reset link is no longer valid.")

    try:
        user_id = verify_reset_token(body.token, user["password_hash"])
    except AuthError as exc:
        raise HTTPException(400, str(exc)) from exc
    if user_id != user["user_id"]:
        raise HTTPException(400, "This reset link is no longer valid.")

    users.set_password(user_id, hash_password(body.password))
    log.info("password reset for %s", user_id)
    refreshed = users.get_by_id(user_id)
    return {"token": issue_token(user_id), "user": _public(refreshed)}


@app.get("/auth/me")
def me(user: dict = Depends(current_user)) -> dict:
    return _public(user)


@app.delete("/account", status_code=204, response_class=Response)
def delete_account(user: dict = Depends(current_user)) -> Response:
    """Remove the account. Cases are left on disk but become unreachable, since
    every case route requires a token that can no longer be issued."""
    users.delete(user["user_id"])
    log.info("account deleted %s", user["user_id"])
    return Response(status_code=204)



@app.get("/auth/config")
def auth_config() -> dict:
    """What sign-in methods this deployment offers.

    The frontend renders the Google button only when this says so, rather than
    showing a control that would fail on click.
    """
    return {
        "google_enabled": google_configured(),
        "google_client_id": google_client_id() if google_configured() else None,
    }


@app.post("/auth/google")
def google_login(body: GoogleCredential) -> dict:
    """Sign in with Google.

    The credential is verified against Google's public keys before anything is
    trusted. Only the opaque subject id is kept — no email, name, or picture is
    stored, so a Google-linked account is no more identifying to TrueTrace than
    a pseudonymous one. What it does cost the user is anonymity toward Google,
    which the UI states plainly at the point of choice.
    """
    if not google_configured():
        raise HTTPException(501, "Google Sign-In is not enabled on this server.")
    try:
        sub = verify_google_credential(body.credential)
    except GoogleAuthError as exc:
        raise HTTPException(401, str(exc)) from exc

    user = users.get_by_google_sub(sub)
    created = user is None
    if user is None:
        user = users.create_google_user(sub)
    log.info("google sign-in %s (%s)", user["user_id"], "new" if created else "returning")
    return {"token": issue_token(user["user_id"]), "user": _public(user), "created": created}


@app.post("/cases", status_code=202)
def create_case(
    body: CreateCase,
    background: BackgroundTasks,
    user: dict = Depends(current_user),
) -> dict:
    case_id = f"case-{uuid.uuid4().hex[:12]}"
    store.create(
        {
            "case_id": case_id,
            "owner": user["user_id"],
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


@app.get("/cases")
def list_cases(user: dict = Depends(current_user)) -> list[dict]:
    """Cases belonging to one pseudonymous owner id.

    Returns a trimmed summary rather than the full record - notably WITHOUT the
    preview frame, so a list view can never render someone's content back at
    them unasked.
    """
    return [
        {
            "case_id": c["case_id"],
            "status": c["status"],
            "source_url": c["source_url"],
            "created_at": c["created_at"],
            "band": (c.get("analysis") or {}).get("band"),
        }
        for c in store.list_for_owner(user["user_id"])
    ]


def _owned(case_id: str, user: dict) -> dict:
    """Fetch a case, or 404 if it does not exist OR is not this user's.

    Deliberately 404 rather than 403 for someone else's case: a 403 would
    confirm the case id is real, which is exactly the kind of detail that
    should not leak in this product.
    """
    case = store.get(case_id)
    if case is None or case.get("owner") != user["user_id"]:
        raise HTTPException(404, "case not found")
    return case


@app.get("/cases/{case_id}")
def get_case(case_id: str, user: dict = Depends(current_user)) -> dict:
    return _owned(case_id, user)


@app.get("/cases/{case_id}/report")
def get_report(case_id: str, user: dict = Depends(current_user)) -> dict:
    case = _owned(case_id, user)
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

        # Gemini rewrites the template limitations into plain prose. It receives
        # ONLY derived numbers - see core/explain.py for the allowlist - and it
        # never decides the band. When it is unconfigured or fails, `friendly`
        # stays None and the UI shows the template text, which is already
        # accurate and carries the measured error rates.
        friendly = gemini_explain(analysis, analysis.get("limitations", []))
        if friendly:
            analysis["explanation"] = friendly
            analysis["explanation_source"] = "gemini"
            store.append_audit(case_id, "explained", "gemini")

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
        out_dir = Path(EVIDENCE_DIR)
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
