"""Identity-match decision logic.

Same pattern as test_scoring.py: exercises the pure decision function, not the
real embedding model - loading facenet-pytorch's ~110MB of weights has no
place in a fast unit suite. The model itself was validated manually against
cached real face crops; see docs/identity-matching-findings.md for those
numbers (same-person similarity 0.80-0.91, random-noise ceiling 0.15).
"""
import pytest

from app.identity import cosine_similarity, decide_match
from app.config import settings
import numpy as np


def test_identical_vectors_have_similarity_one():
    v = np.array([0.3, 0.1, -0.2, 0.9])
    assert cosine_similarity(v, v) == pytest.approx(1.0)


def test_opposite_vectors_have_similarity_minus_one():
    v = np.array([1.0, 0.0])
    assert cosine_similarity(v, -v) == pytest.approx(-1.0)


def test_orthogonal_vectors_have_similarity_zero():
    a = np.array([1.0, 0.0])
    b = np.array([0.0, 1.0])
    assert cosine_similarity(a, b) == pytest.approx(0.0)


def test_zero_vector_does_not_divide_by_zero():
    zero = np.array([0.0, 0.0, 0.0])
    other = np.array([1.0, 2.0, 3.0])
    # Must return a plain float, never NaN or an exception - a broken
    # embedding must fail the match, not crash the pipeline.
    assert cosine_similarity(zero, other) == 0.0


@pytest.mark.parametrize("similarity", [0.0, 0.15, 0.39])
def test_similarity_below_threshold_is_not_a_match(similarity):
    assert decide_match(similarity) is False


@pytest.mark.parametrize("similarity", [0.40, 0.6, 0.85, 1.0])
def test_similarity_at_or_above_threshold_is_a_match(similarity):
    assert decide_match(similarity) is True


def test_threshold_is_the_documented_lenient_value():
    """Pinned so a change to this safety-relevant constant is a visible,
    deliberate diff rather than an accidental one-line edit."""
    assert settings.identity_match_threshold == pytest.approx(0.40)


def test_measured_noise_ceiling_is_comfortably_below_threshold():
    """Regression guard for the actual finding in identity.py's docstring:
    random noise topped out at 0.15 against real faces. If the threshold is
    ever lowered toward that ceiling, false accepts become likely."""
    measured_noise_ceiling = 0.16
    assert settings.identity_match_threshold > measured_noise_ceiling
