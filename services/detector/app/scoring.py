"""Turning per-frame probabilities into an honest, explainable result.

The product promise is a *risk score, never a verdict*. That promise lives here:
this module is the only place allowed to decide what the numbers mean, and it is
required to be able to say "I don't know".
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from enum import Enum

from .config import settings


class Band(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    INCONCLUSIVE = "inconclusive"


@dataclass
class FrameResult:
    index: int
    scored: bool
    score: float | None = None
    face_confidence: float | None = None
    reason: str | None = None  # why it wasn't scored


@dataclass
class Aggregate:
    band: Band
    score: float | None
    frames_submitted: int
    frames_with_face: int
    frames_scored: int
    flagged_fraction: float | None
    dispersion: float | None
    limitations: list[str] = field(default_factory=list)
    frames: list[FrameResult] = field(default_factory=list)


def aggregate(frames: list[FrameResult], frames_submitted: int) -> Aggregate:
    scored = [f for f in frames if f.scored and f.score is not None]
    with_face = [f for f in frames if f.face_confidence is not None]
    limitations: list[str] = []

    # Not enough usable frames is a real, common outcome on compressed social
    # video. Returning a number here would be inventing confidence we lack.
    if len(scored) < settings.min_scored_frames:
        limitations.append(
            f"Only {len(scored)} of {frames_submitted} sampled frames contained a "
            f"clearly detectable face, which is below the minimum of "
            f"{settings.min_scored_frames} needed to report a score."
        )
        return Aggregate(
            band=Band.INCONCLUSIVE,
            score=None,
            frames_submitted=frames_submitted,
            frames_with_face=len(with_face),
            frames_scored=len(scored),
            flagged_fraction=None,
            dispersion=None,
            limitations=limitations,
            frames=frames,
        )

    values = sorted((f.score for f in scored), reverse=True)
    k = max(1, int(len(values) * settings.topk_ratio))
    # Top-k mean, not a plain mean: manipulation is often confined to a subset of
    # frames, and averaging over clean frames washes that signal out.
    score = sum(values[:k]) / k

    flagged = sum(1 for v in values if v >= settings.frame_flag_threshold)
    flagged_fraction = flagged / len(values)
    dispersion = statistics.pstdev(values) if len(values) > 1 else 0.0

    if score < settings.band_low_max:
        band = Band.LOW
    elif score < settings.band_moderate_max:
        band = Band.MODERATE
    else:
        band = Band.HIGH

    limitations.append(
        "This is a statistical risk estimate from an automated model, not a "
        "determination that the video is or is not manipulated."
    )
    if dispersion > 0.25:
        limitations.append(
            "Frame-level results disagreed with each other substantially, which "
            "can happen with heavy compression, edited segments, or brief appearances."
        )
    if len(scored) < frames_submitted * 0.5:
        limitations.append(
            f"Fewer than half the sampled frames were usable ({len(scored)} of "
            f"{frames_submitted}), so this result rests on a limited sample."
        )

    return Aggregate(
        band=band,
        score=round(score, 4),
        frames_submitted=frames_submitted,
        frames_with_face=len(with_face),
        frames_scored=len(scored),
        flagged_fraction=round(flagged_fraction, 4),
        dispersion=round(dispersion, 4),
        limitations=limitations,
        frames=frames,
    )
