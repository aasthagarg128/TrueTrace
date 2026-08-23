"""The scoring contract: a score when we have evidence, silence when we don't."""
import pytest

from app.config import settings
from app.scoring import Band, FrameResult, aggregate


def scored(n: int, value: float) -> list[FrameResult]:
    return [
        FrameResult(index=i, scored=True, score=value, face_confidence=0.9)
        for i in range(n)
    ]


def test_too_few_faces_is_inconclusive_not_a_score():
    frames = scored(settings.min_scored_frames - 1, 0.95)
    result = aggregate(frames, frames_submitted=16)
    assert result.band is Band.INCONCLUSIVE
    # The critical assertion: we must not emit a number we can't stand behind,
    # even when the few frames we did score looked overwhelmingly manipulated.
    assert result.score is None
    assert result.limitations


def test_no_faces_at_all_is_inconclusive():
    frames = [FrameResult(index=i, scored=False, reason="no_face") for i in range(16)]
    result = aggregate(frames, frames_submitted=16)
    assert result.band is Band.INCONCLUSIVE
    assert result.frames_scored == 0


@pytest.mark.parametrize(
    "value,expected",
    [(0.05, Band.LOW), (0.50, Band.MODERATE), (0.95, Band.HIGH)],
)
def test_bands_track_score(value, expected):
    result = aggregate(scored(16, value), frames_submitted=16)
    assert result.band is expected
    assert result.score == pytest.approx(value, abs=1e-3)


def test_every_confident_result_carries_limitations():
    result = aggregate(scored(16, 0.95), frames_submitted=16)
    assert result.band is Band.HIGH
    # Transparency NFR: a score is never allowed to travel without its caveat.
    assert any("not a determination" in l for l in result.limitations)


def test_topk_mean_does_not_wash_out_localised_manipulation():
    # Half the frames are clean, half are strongly flagged - as happens when only
    # part of a video is manipulated. A plain mean would report ~0.5 (Moderate).
    frames = scored(8, 0.95) + [
        FrameResult(index=8 + i, scored=True, score=0.05, face_confidence=0.9)
        for i in range(8)
    ]
    result = aggregate(frames, frames_submitted=16)
    assert result.band is Band.HIGH
    assert result.score > 0.9


def test_disagreement_between_frames_is_surfaced():
    frames = scored(8, 0.95) + [
        FrameResult(index=8 + i, scored=True, score=0.05, face_confidence=0.9)
        for i in range(8)
    ]
    result = aggregate(frames, frames_submitted=16)
    assert result.dispersion > 0.25
    assert any("disagreed" in l for l in result.limitations)


def test_thin_sample_is_flagged_even_when_scoreable():
    frames = scored(5, 0.2) + [
        FrameResult(index=5 + i, scored=False, reason="no_face") for i in range(11)
    ]
    result = aggregate(frames, frames_submitted=16)
    assert result.band is Band.LOW
    assert any("limited sample" in l for l in result.limitations)
