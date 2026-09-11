"""Detector service: face crops in, risk band out.

Deliberately knows nothing about cases, users, or storage. It receives frames,
never the source video and never a URL, so the most sensitive artifact in the
system has the smallest possible blast radius.
"""
from __future__ import annotations

import dataclasses
import hmac
import logging
import os
import time

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from .classifier import get_classifier
from .config import settings
from .faces import FaceDetector
from .identity import IdentityMatcher, cosine_similarity, decide_match
from .scoring import FrameResult, aggregate

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="TrueTrace Detector", version="0.1.0")
_faces: FaceDetector | None = None
_identity: IdentityMatcher | None = None


def require_shared_secret(authorization: str | None = Header(default=None)) -> None:
    """This service handles the most sensitive material in the system (face
    crops of reported content) and has no reason to be reachable by anyone
    but the agents API. A plain shared secret, not a cloud-provider identity
    token, because this runs on whatever host is cheapest - Cloud Run one
    week, Render the next - and a portable check beats one tied to a
    specific platform's metadata server.

    Unset DETECTOR_SHARED_SECRET means local dev: every request passes,
    exactly as before this existed. Set it in any real deployment.
    """
    secret = os.getenv("DETECTOR_SHARED_SECRET", "")
    if not secret:
        return
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "missing or invalid shared secret")
    provided = authorization.split(" ", 1)[1].strip()
    # constant-time compare: a timing side-channel on a shared secret is a
    # real way to brute-force it request by request.
    if not hmac.compare_digest(provided, secret):
        raise HTTPException(401, "missing or invalid shared secret")


@app.on_event("startup")
def _startup() -> None:
    global _faces, _identity
    _faces = FaceDetector()
    _identity = IdentityMatcher()
    # Warm both models now so the first real request isn't paying for a cold load.
    get_classifier().load()
    _identity.load()
    log.info("detector ready")


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "model": get_classifier().version}


@app.post("/score", dependencies=[Depends(require_shared_secret)])
async def score(frames: list[UploadFile] = File(...)) -> JSONResponse:
    started = time.monotonic()
    assert _faces is not None

    crops: list[np.ndarray] = []
    crop_slots: list[int] = []  # index into results for each crop we send
    results: list[FrameResult] = []

    for i, upload in enumerate(frames):
        raw = np.frombuffer(await upload.read(), dtype=np.uint8)
        image = cv2.imdecode(raw, cv2.IMREAD_COLOR)
        if image is None:
            results.append(FrameResult(index=i, scored=False, reason="undecodable"))
            continue

        face = _faces.largest_face(image)
        if face is None:
            results.append(FrameResult(index=i, scored=False, reason="no_face"))
            continue

        results.append(
            FrameResult(index=i, scored=True, face_confidence=face.confidence)
        )
        crop_slots.append(len(results) - 1)
        crops.append(face.image)

    scores = get_classifier().score_batch(crops)
    for slot, value in zip(crop_slots, scores):
        results[slot].score = value

    agg = aggregate(results, frames_submitted=len(frames))
    payload = dataclasses.asdict(agg)
    payload["band"] = agg.band.value
    payload["model_version"] = get_classifier().version
    payload["elapsed_ms"] = int((time.monotonic() - started) * 1000)
    return JSONResponse(payload)


@app.post("/identity/verify", dependencies=[Depends(require_shared_secret)])
async def verify_identity(
    reference: UploadFile = File(...),
    frames: list[UploadFile] = File(...),
) -> JSONResponse:
    """Does a face in `reference` match a face in any of `frames`?

    Independent of /score on purpose: this never touches the deepfake
    classifier, and /score never touches this. A match result says nothing
    about manipulation, and a manipulation score says nothing about identity.
    """
    assert _identity is not None
    started = time.monotonic()

    ref_raw = np.frombuffer(await reference.read(), dtype=np.uint8)
    ref_image = cv2.imdecode(ref_raw, cv2.IMREAD_COLOR)
    if ref_image is None:
        return JSONResponse({"error": "reference photo could not be decoded"}, status_code=400)

    ref_embedding = _identity.embed(cv2.cvtColor(ref_image, cv2.COLOR_BGR2RGB))
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
        emb = _identity.embed(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
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
        "threshold": settings.identity_match_threshold,
        "frames_with_face": frames_with_face,
        "elapsed_ms": int((time.monotonic() - started) * 1000),
    })
