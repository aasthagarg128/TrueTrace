"""The scoring contract: a signal when we have evidence, silence when we don't,
and measured error rates attached to whatever we do say."""
import pytest

from app.config import settings
from app.scoring import Band, FrameResult, aggregate


def scored(n: int, value: float, start: int = 0) -> list[FrameResult]:
    return [
        FrameResult(index=start + i, scored=True, score=value, face_confidence=0.9)
        for i in range(n)
    ]


def test_too_few_faces_is_inconclusive_not_a_score():
    frames = scored(settings.min_scored_frames - 1, 0.99)
    result = aggregate(frames, frames_submitted=16)
    assert result.band is Band.INCONCLUSIVE
    # The critical assertion: we must not emit a number we can't stand behind,
    # even when the few frames we did score looked overwhelmingly manipulated.
    assert result.score is None
    assert any("No conclusion should be drawn" in l for l in result.limitations)


def test_no_faces_at_all_is_inconclusive():
    frames = [FrameResult(index=i, scored=False, reason="no_face") for i in range(16)]
    result = aggregate(frames, frames_submitted=16)
    assert result.band is Band.INCONCLUSIVE
    assert result.frames_scored == 0


def test_peak_above_threshold_is_flagged():
    result = aggregate(scored(16, 0.95), frames_submitted=16)
    assert result.band is Band.FLAGGED
    assert result.score == pytest.approx(0.95)


def test_peak_below_threshold_is_not_flagged():
    result = aggregate(scored(16, 0.80), frames_submitted=16)
    assert result.band is Band.NOT_FLAGGED


def test_a_single_elevated_frame_is_enough_to_flag():
    # Manipulation is often confined to a few frames; the max aggregation was
    # measured as the strongest separator precisely because of this.
    frames = scored(15, 0.10) + scored(1, 0.97, start=15)
    result = aggregate(frames, frames_submitted=16)
    assert result.band is Band.FLAGGED


def test_flag_always_carries_its_false_positive_rate():
    result = aggregate(scored(16, 0.99), frames_submitted=16)
    joined = " ".join(result.limitations)
    assert "not a determination" in joined
    # A flag must never travel without how often it is wrong.
    assert "authentic" in joined
    assert f"{1 - settings.measured_precision:.0%}" in joined


def test_non_flag_is_never_presented_as_reassurance():
    result = aggregate(scored(16, 0.05), frames_submitted=16)
    joined = " ".join(result.limitations)
    assert result.band is Band.NOT_FLAGGED
    # The asymmetry that matters most: a victim must not read a non-flag as
    # "your video is fine".
    assert "NOT a finding that" in joined
    assert "misses" in joined


def test_every_conclusive_result_reports_the_validation_corpus():
    for value in (0.99, 0.05):
        result = aggregate(scored(16, value), frames_submitted=16)
        assert any("validated on" in l for l in result.limitations)


def test_thin_sample_is_flagged_even_when_scoreable():
    frames = scored(5, 0.2) + [
        FrameResult(index=5 + i, scored=False, reason="no_face") for i in range(11)
    ]
    result = aggregate(frames, frames_submitted=16)
    assert result.band is Band.NOT_FLAGGED
    assert any("limited sample" in l for l in result.limitations)


def test_dispersion_is_reported_for_disagreeing_frames():
    frames = scored(8, 0.95) + scored(8, 0.05, start=8)
    result = aggregate(frames, frames_submitted=16)
    assert result.dispersion > 0.25


def test_flagged_fraction_counts_only_elevated_frames():
    frames = scored(4, 0.95) + scored(12, 0.10, start=4)
    result = aggregate(frames, frames_submitted=16)
    assert result.flagged_fraction == pytest.approx(0.25)


def test_no_band_is_ever_a_numeric_risk_scale():
    # Guards against reintroducing a graded score the model cannot support.
    assert {b.value for b in Band} == {"inconclusive", "not_flagged", "flagged"}
