"""Face identity matching: does a reference photo match a face in the video?

Second implementation of this idea in this project's history - the first,
in services/detector, used facenet-pytorch (MTCNN + InceptionResnetV1 on
VGGFace2). That version worked and was validated, but its memory footprint
(488MB idle, 550-588MB under a real request, after every free optimisation
tried - resizing input, capping threads, no_grad, periodic gc) didn't fit
this project's free-tier host alongside the deepfake classifier, or even
alone in its own service.

This version is onnxruntime + insightface's "buffalo_s" pack (SCRFD
detection, a compact ArcFace-style recognition head) instead. No PyTorch at
all. Re-validated on the same cached face crops used throughout this
project, not assumed to be equivalent just because the task is the same:

  Measurement                    facenet-pytorch      insightface buffalo_s
  ----------------------------   ------------------    ------------------
  peak memory, 16-frame request   550-588MB             361MB
  same-person similarity          mean 0.79  min 0.74   mean 0.71  min 0.66
  faces found (of 16 test crops)  15-16                 16
  behaviour on pure noise input   max sim 0.15           no face detected

Lower absolute similarity scores are expected - it's a different embedding
space, not a worse one; MATCH_THRESHOLD below is calibrated for this space,
not carried over from the old one. The noise behaviour is arguably better:
SCRFD refuses to report a face in noise at all, rather than returning a low
but non-zero similarity.
"""
from __future__ import annotations

import logging
import os
import threading

import numpy as np

from .config import settings

log = logging.getLogger(__name__)

# Belt and braces alongside the Dockerfile's OMP_NUM_THREADS=1: onnxruntime
# reads this at session-creation time, so setting it here too covers any
# import order where the Dockerfile env hasn't taken effect yet.
os.environ.setdefault("OMP_NUM_THREADS", "1")


class IdentityMatcher:
    """Lazily loaded: import stays cheap, the model files only load when
    actually needed - same pattern as the classifier this sits alongside
    conceptually, even though it now lives in a separate process."""

    def __init__(self) -> None:
        self._app = None
        self._lock = threading.Lock()

    def load(self) -> None:
        if self._app is not None:
            return
        with self._lock:
            if self._app is not None:
                return
            import insightface

            app = insightface.app.FaceAnalysis(
                name=settings.model_pack, providers=["CPUExecutionProvider"]
            )
            app.prepare(ctx_id=0, det_size=(settings.detection_size, settings.detection_size))
            self._app = app
            log.info("identity matcher ready (insightface %s)", settings.model_pack)

    def embed(self, image_bgr: np.ndarray) -> np.ndarray | None:
        """Detect the largest face and return its embedding, or None.

        None means "no usable face" and must never be treated as a
        similarity of zero - a caller that did that would misreport a
        confident non-match instead of an inconclusive one.
        """
        self.load()
        faces = self._app.get(image_bgr)
        if not faces:
            return None
        # Largest, not first - same convention as the deepfake classifier's
        # face detector: on a frame with bystanders, the subject is almost
        # always the largest face, and matching a bystander is both wrong
        # and a privacy problem.
        largest = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        return largest.normed_embedding


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0.0:
        return 0.0
    return float(np.dot(a, b) / denom)


def decide_match(similarity: float) -> bool:
    """The single place that turns a number into a yes/no. See config.py
    for why this threshold is where it is."""
    return similarity >= settings.match_threshold
