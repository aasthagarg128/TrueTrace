"""Deepfake classifier behind a swappable interface.

There is no Google-provided deepfake model, so this is an open-source Hugging
Face checkpoint running in our own container. The Protocol exists so the
checkpoint can be swapped after benchmarking without touching the pipeline.
"""
from __future__ import annotations

import logging
import threading
from typing import Protocol

import numpy as np
from PIL import Image

from .config import settings

log = logging.getLogger(__name__)


class Classifier(Protocol):
    @property
    def version(self) -> str:
        """Identifier recorded in the evidence manifest for reproducibility."""

    def score_batch(self, crops: list[np.ndarray]) -> list[float]:
        """Return P(manipulated) in [0, 1] for each BGR face crop."""


class HuggingFaceClassifier:
    """Lazily loaded so import stays cheap; warmed explicitly at startup."""

    def __init__(self) -> None:
        self._model = None
        self._processor = None
        self._fake_index: int | None = None
        self._lock = threading.Lock()

    @property
    def version(self) -> str:
        return f"{settings.model_id}@{settings.model_revision}"

    def load(self) -> None:
        if self._model is not None:
            return
        with self._lock:
            if self._model is not None:
                return
            import torch
            from transformers import AutoImageProcessor, AutoModelForImageClassification

            log.info("loading classifier %s", self.version)
            self._processor = AutoImageProcessor.from_pretrained(
                settings.model_id, revision=settings.model_revision
            )
            model = AutoModelForImageClassification.from_pretrained(
                settings.model_id, revision=settings.model_revision
            )
            model.eval()
            self._model = model
            self._fake_index = self._resolve_fake_index(model.config.id2label)
            log.info(
                "classifier ready; labels=%s fake_index=%s",
                model.config.id2label,
                self._fake_index,
            )

    @staticmethod
    def _resolve_fake_index(id2label: dict[int, str]) -> int:
        """Find which logit means 'manipulated'.

        Checkpoints disagree on label order and wording ('fake', 'Deepfake',
        'artificial'). Guessing index 0 or 1 silently inverts every score, which
        is the single worst failure mode this service has — so we resolve it
        explicitly and refuse to run if we cannot.
        """
        fake_words = ("fake", "deepfake", "manipulat", "artificial", "synthetic", "ai")
        for idx, label in id2label.items():
            if any(w in label.lower() for w in fake_words):
                return int(idx)
        raise RuntimeError(
            f"Cannot determine which label means 'manipulated' from {id2label}. "
            "Set it explicitly before trusting any score from this checkpoint."
        )

    def score_batch(self, crops: list[np.ndarray]) -> list[float]:
        if not crops:
            return []
        self.load()
        import torch

        images = [Image.fromarray(c[:, :, ::-1]) for c in crops]  # BGR -> RGB
        inputs = self._processor(images=images, return_tensors="pt")
        with torch.no_grad():
            logits = self._model(**inputs).logits
            probs = torch.softmax(logits, dim=-1)
        return [float(p[self._fake_index]) for p in probs]


_classifier: HuggingFaceClassifier | None = None


def get_classifier() -> HuggingFaceClassifier:
    global _classifier
    if _classifier is None:
        _classifier = HuggingFaceClassifier()
    return _classifier
