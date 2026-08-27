"""Turning per-frame probabilities into an honest, explainable result.

The product promise is a *screening signal, never a verdict*. That promise lives
here: this module is the only place allowed to decide what the numbers mean, and
it is required to be able to say "I don't know".

Two deliberate design choices, both forced by measurement rather than taste:

1. The output is three-state, not a four-band risk scale. The detector's measured
   AUC is 0.701 - real signal, but nowhere near enough to support a graded score.
   A number like "risk 0.62" would imply a precision this model does not have.

2. Every result carries the *measured* error rates for the threshold that
   produced it. A flag that does not travel with "this is wrong about 23% of the
   time" invites the reader to treat it as a finding.
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from enum import Enum

from .config import settings


class Band(str, Enum):
    # Too little usable material to say anything at all.
    INCONCLUSIVE = "inconclusive"
    # Screening did not flag it. NOT a statement that the video is authentic.
    NOT_FLAGGED = "not_flagged"
    # Screening flagged it, with the measured error rates attached.
    FLAGGED = "flagged"


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


def _accuracy_note() -> str:
    return (
        f"This screening was validated on {settings.measured_corpus}. At the "
        f"threshold used it correctly identified {settings.measured_recall:.0%} of "
        f"manipulated videos, and wrongly flagged {settings.measured_false_positive_rate:.0%} "
        f"of authentic ones."
    )


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
            f"{settings.min_scored_frames} needed to screen this content."
        )
        limitations.append(
            "No conclusion should be drawn from this result in either direction."
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
    # Maximum, not a mean: measured as the strongest separator (AUC 0.701 vs
    # 0.632 for the mean). Manipulation is often confined to a few frames, and
    # averaging over clean frames washes that signal out.
    peak = values[0]

    elevated = sum(1 for v in values if v >= settings.flag_threshold)
    flagged_fraction = elevated / len(values)
    dispersion = statistics.pstdev(values) if len(values) > 1 else 0.0

    if peak >= settings.flag_threshold:
        band = Band.FLAGGED
        limitations.append(
            "This is an automated screening signal, not a determination that the "
            "video is manipulated."
        )
        limitations.append(_accuracy_note())
        limitations.append(
            f"Roughly {1 - settings.measured_precision:.0%} of the videos this "
            f"screening flags are in fact authentic."
        )
    else:
        band = Band.NOT_FLAGGED
        # The asymmetry matters: a non-flag is much weaker evidence than a flag,
        # and a victim must not read it as reassurance.
        limitations.append(
            "This screening did not flag the content. That is NOT a finding that "
            "the video is authentic."
        )
        limitations.append(
            f"The screening misses roughly {1 - settings.measured_recall:.0%} of "
            f"manipulated videos, so a non-flag is weak evidence."
        )
        limitations.append(_accuracy_note())

    if len(scored) < frames_submitted * 0.5:
        limitations.append(
            f"Fewer than half the sampled frames were usable ({len(scored)} of "
            f"{frames_submitted}), so this result rests on a limited sample."
        )

    return Aggregate(
        band=band,
        score=round(peak, 4),
        frames_submitted=frames_submitted,
        frames_with_face=len(with_face),
        frames_scored=len(scored),
        flagged_fraction=round(flagged_fraction, 4),
        dispersion=round(dispersion, 4),
        limitations=limitations,
        frames=frames,
    )
