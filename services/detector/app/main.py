"""Detector service: face crops in, risk band out.

Deliberately knows nothing about cases, users, or storage. It receives frames,
never the source video and never a URL, so the most sensitive artifact in the
system has the smallest possible blast radius.
"""
from __future__ import annotations

import dataclasses
import logging
import time

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse

from .classifier import get_classifier
from .config import settings
from .faces import FaceDetector
from .scoring import FrameResult, aggregate

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="TrueTrace Detector", version="0.1.0")
_faces: FaceDetector | None = None


@app.on_event("startup")
def _startup() -> None:
    global _faces
    _faces = FaceDetector()
    # Warm the model now so the first real request isn't paying for a cold load.
    get_classifier().load()
    log.info("detector ready")


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "model": get_classifier().version}


@app.post("/score")
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
