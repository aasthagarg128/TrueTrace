"""Face location via MediaPipe.

We crop to faces before classifying because the deepfake checkpoints are trained
on face crops, not full frames. Scoring a whole frame quietly destroys accuracy.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import cv2
import mediapipe as mp
import numpy as np

from .config import settings

log = logging.getLogger(__name__)

# Margin added around the detected box. The checkpoints see hairline and jaw
# during training; a tight box drops signal the model relies on.
_CROP_MARGIN = 0.25


@dataclass(frozen=True)
class FaceCrop:
    image: np.ndarray
    confidence: float


class FaceDetector:
    """Wraps MediaPipe. model_selection=1 is the full-range model, which holds up
    better on the small, off-angle faces typical of re-encoded social video."""

    def __init__(self) -> None:
        self._detector = mp.solutions.face_detection.FaceDetection(
            model_selection=1,
            min_detection_confidence=settings.face_min_confidence,
        )

    def largest_face(self, frame_bgr: np.ndarray) -> FaceCrop | None:
        """Return the biggest face in the frame, or None if there isn't one.

        Biggest, not first: on a frame with bystanders the subject is almost
        always the largest face, and scoring a bystander is both wrong and a
        privacy problem.
        """
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        result = self._detector.process(rgb)
        if not result.detections:
            return None

        h, w = frame_bgr.shape[:2]
        best = None
        best_area = 0.0

        for det in result.detections:
            box = det.location_data.relative_bounding_box
            area = box.width * box.height
            if area > best_area:
                best_area = area
                best = (box, det.score[0] if det.score else 0.0)

        if best is None:
            return None

        box, confidence = best
        x1 = int((box.xmin - box.width * _CROP_MARGIN) * w)
        y1 = int((box.ymin - box.height * _CROP_MARGIN) * h)
        x2 = int((box.xmin + box.width * (1 + _CROP_MARGIN)) * w)
        y2 = int((box.ymin + box.height * (1 + _CROP_MARGIN)) * h)

        # MediaPipe returns boxes that can extend past the frame edge.
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        if x2 - x1 < 32 or y2 - y1 < 32:
            return None

        return FaceCrop(image=frame_bgr[y1:y2, x1:x2], confidence=float(confidence))

    def close(self) -> None:
        self._detector.close()
