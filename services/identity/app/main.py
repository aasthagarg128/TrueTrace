"""Identity-matching service: a reference photo and video frames in, a
match decision out.

Split from services/detector purely for memory - see identity.py's module
docstring for the measurements that drove it. Otherwise the same design
rules apply: no case data, no user id, no URL. This service has no idea
what it's being used for, only whether two faces look like the same person.
"""
from __future__ import annotations

import hmac
import logging
import os
import time

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from .config import settings
from .identity import IdentityMatcher, cosine_similarity, decide_match

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="TrueTrace Identity", version="0.1.0")
_identity: IdentityMatcher | None = None


def require_shared_secret(authorization: str | None = Header(default=None)) -> None:
    """Same contract as services/detector's version of this check - see
    that module for the full rationale. Kept as an independent copy rather
    than a shared import: these are two separately deployed services, and a
    shared library between them would be one more thing to keep in sync
    across two Render deploys for a six-line function."""
    secret = os.getenv("IDENTITY_SHARED_SECRET", "")
    if not secret:
        return
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "missing or invalid shared secret")
    provided = authorization.split(" ", 1)[1].strip()
    if not hmac.compare_digest(provided, secret):
        raise HTTPException(401, "missing or invalid shared secret")


@app.on_event("startup")
def _startup() -> None:
    global _identity
    _identity = IdentityMatcher()
    _identity.load()  # warm now, not on the first real request
    log.info("identity service ready")


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "model_pack": settings.model_pack}


@app.post("/identity/verify", dependencies=[Depends(require_shared_secret)])
async def verify_identity(
    reference: UploadFile = File(...),
    frames: list[UploadFile] = File(...),
) -> JSONResponse:
    assert _identity is not None
    started = time.monotonic()

    ref_raw = np.frombuffer(await reference.read(), dtype=np.uint8)
    ref_image = cv2.imdecode(ref_raw, cv2.IMREAD_COLOR)
    if ref_image is None:
        return JSONResponse({"error": "reference photo could not be decoded"}, status_code=400)

    ref_embedding = _identity.embed(ref_image)
    if ref_embedding is None:
        return JSONResponse(
            {"matched": False, "reason": "no_face_in_reference", "best_similarity": None},
            status_code=200,
        )

    frames_with_face = 0
    best_similarity = -1.0
    for upload in frames:
        raw = np.frombuffer(await upload.read(), dtype=np.uint8)
        image = cv2.imdecode(raw, cv2.IMREAD_COLOR)
        if image is None:
            continue
        emb = _identity.embed(image)
        if emb is None:
            continue
        frames_with_face += 1
        best_similarity = max(best_similarity, cosine_similarity(ref_embedding, emb))

    if frames_with_face == 0:
        return JSONResponse(
            {"matched": False, "reason": "no_face_in_video_frames", "best_similarity": None},
            status_code=200,
        )

    matched = decide_match(best_similarity)
    return JSONResponse({
        "matched": matched,
        "reason": None if matched else "below_threshold",
        "best_similarity": round(best_similarity, 4),
        "threshold": settings.match_threshold,
        "frames_with_face": frames_with_face,
        "elapsed_ms": int((time.monotonic() - started) * 1000),
    })
