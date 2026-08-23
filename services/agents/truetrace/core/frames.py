"""Video -> a handful of JPEG frames.

Sampling happens here, on the machine that fetched the video, so the raw video
never crosses a network boundary or lands in cloud storage. Only these frames
travel to the detector.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import cv2

log = logging.getLogger(__name__)

_JPEG_QUALITY = 92


@dataclass(frozen=True)
class SampledFrame:
    index: int
    position_ms: float
    jpeg: bytes


def sample_frames(video_path: str | Path, count: int = 16) -> list[SampledFrame]:
    """Sample `count` frames spread evenly across the video.

    Evenly rather than from the start: manipulated segments are often brief and
    rarely at the opening, and front-loaded sampling would miss them.
    """
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise ValueError(f"could not open video: {video_path}")

    try:
        total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = capture.get(cv2.CAP_PROP_FPS) or 25.0

        # Frame counts from container metadata are often wrong on re-encoded
        # social video, so fall back to sequential reads when it looks bogus.
        if total <= 0:
            return _sample_sequential(capture, count, fps)

        step = max(1, total // count)
        targets = [min(i * step, total - 1) for i in range(count)]

        frames: list[SampledFrame] = []
        for i, target in enumerate(targets):
            capture.set(cv2.CAP_PROP_POS_FRAMES, target)
            ok, image = capture.read()
            if not ok or image is None:
                continue
            ok, buf = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, _JPEG_QUALITY])
            if not ok:
                continue
            frames.append(
                SampledFrame(index=i, position_ms=(target / fps) * 1000.0, jpeg=buf.tobytes())
            )
        return frames
    finally:
        capture.release()


def _sample_sequential(capture, count: int, fps: float) -> list[SampledFrame]:
    """Fallback for videos whose frame count we can't trust: read straight
    through and keep every Nth frame."""
    frames: list[SampledFrame] = []
    read = 0
    keep_every = 10
    while len(frames) < count:
        ok, image = capture.read()
        if not ok:
            break
        if read % keep_every == 0:
            ok, buf = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, _JPEG_QUALITY])
            if ok:
                frames.append(
                    SampledFrame(
                        index=len(frames), position_ms=(read / fps) * 1000.0, jpeg=buf.tobytes()
                    )
                )
        read += 1
    return frames
