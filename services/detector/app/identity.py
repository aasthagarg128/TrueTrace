"""Face identity matching: does a reference photo match a face in the video?

Kept deliberately separate from `classifier.py`. The deepfake classifier asks
"does this footage look manipulated" and has no concept of whose face it is;
this module asks the opposite question - "is this the same person" - and has
no opinion on manipulation. Conflating the two would make it possible to
report a match as if it said something about authenticity, which it does not.

Model: `InceptionResnetV1` (FaceNet architecture) pretrained on VGGFace2, via
`facenet-pytorch`. Chosen because it runs on the CPU-only torch already in
this container, unlike heavier ArcFace/InsightFace stacks that pull in a
second inference runtime.

Detection and alignment use the SAME package's own `MTCNN`, not the
MediaPipe detector `faces.py` uses for the deepfake classifier. This was
measured, not assumed: MediaPipe's bounding box plus a hand-rolled eye
alignment gave same-person similarity (mean ~0.61) that overlapped almost
completely with random noise (mean ~0.48) - useless. Re-detecting with MTCNN,
which this embedding model was actually trained and benchmarked against,
gave same-person similarity of 0.80-0.91 against a noise ceiling of 0.15 on
the same crops. The lesson is the same one `docs/detection-findings.md`
already drew about the deepfake checkpoint: a model's published accuracy does
not transfer across an arbitrary preprocessing pipeline, and the fix is to
measure, not to guess.

Standing limitation, stated plainly: that comparison used one identity
against random noise, not a labelled multi-identity corpus. It proves the
pipeline extracts real signal rather than noise; it does not establish a
calibrated false-accept / false-reject rate the way the deepfake threshold
was calibrated on 78 labelled videos. See docs/identity-matching-findings.md.
"""
from __future__ import annotations

import logging
import threading

import numpy as np

from .config import settings

log = logging.getLogger(__name__)


class IdentityMatcher:
    """Lazily loaded, same pattern as HuggingFaceClassifier: import stays
    cheap, the ~110MB of weights only download/load when actually needed."""

    def __init__(self) -> None:
        self._mtcnn = None
        self._model = None
        self._lock = threading.Lock()

    def load(self) -> None:
        if self._model is not None:
            return
        with self._lock:
            if self._model is not None:
                return
            from facenet_pytorch import MTCNN, InceptionResnetV1

            self._mtcnn = MTCNN(
                image_size=160, margin=0, post_process=True,
                min_face_size=settings.identity_min_face_size,
            )
            self._model = InceptionResnetV1(pretrained="vggface2").eval()
            log.info("identity matcher ready (facenet vggface2)")

    def embed(self, image_rgb: np.ndarray) -> np.ndarray | None:
        """Detect the largest face, align it, and return its 512-d embedding.

        Returns None if no face was found - the caller must treat this as "no
        usable face", never as a similarity of zero, which would misleadingly
        read as a confident non-match.
        """
        import torch

        self.load()
        face = self._mtcnn(image_rgb)
        if face is None:
            return None
        with torch.no_grad():
            return self._model(face.unsqueeze(0))[0].numpy()

    def close(self) -> None:
        self._mtcnn = None
        self._model = None


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0.0:
        return 0.0
    return float(np.dot(a, b) / denom)


def decide_match(similarity: float) -> bool:
    """The single place that turns a number into a yes/no.

    The threshold is deliberately lenient, not tuned for precision. This gate
    blocks case creation when it says no, and the two failure modes are not
    symmetric: a false ACCEPT lets someone file a report grounded in their own
    stated assertion regardless (the report never claims a verified identity
    match), while a false REJECT turns away a real victim, on a photo that may
    be old, poorly lit, or captured at a bad angle, at the exact moment they
    were trying to get help. Measured noise ceiling was 0.15; this threshold
    leaves wide room below the 0.80+ typically seen for a genuine match so
    that ordinary photo-quality variation does not become a rejection.
    """
    return similarity >= settings.identity_match_threshold
