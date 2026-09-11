"""Identity-match decision logic.

Exercises the pure decision function, not the real model - loading
insightface's packaged weights has no place in a fast unit suite. The model
itself was validated manually against cached real face crops; see
app/identity.py's module docstring for those numbers (same-person
similarity mean 0.705 / min 0.664, clean rejection on random noise).
"""
import numpy as np
import pytest

from app.config import settings
from app.identity import cosine_similarity, decide_match


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
    assert cosine_similarity(zero, other) == 0.0


@pytest.mark.parametrize("similarity", [0.0, 0.1, 0.34])
def test_similarity_below_threshold_is_not_a_match(similarity):
    assert decide_match(similarity) is False


@pytest.mark.parametrize("similarity", [0.35, 0.5, 0.705, 1.0])
def test_similarity_at_or_above_threshold_is_a_match(similarity):
    assert decide_match(similarity) is True


def test_threshold_is_the_documented_lenient_value():
    """Pinned so a change to this safety-relevant constant is a visible,
    deliberate diff rather than an accidental one-line edit."""
    assert settings.match_threshold == pytest.approx(0.35)


def test_threshold_sits_below_the_measured_genuine_match_floor():
    """Regression guard for the actual finding in identity.py's docstring:
    real same-person pairs measured as low as 0.664. If the threshold is
    ever raised toward that floor, ordinary photo variation starts causing
    false rejections of real matches."""
    measured_genuine_match_floor = 0.664
    assert settings.match_threshold < measured_genuine_match_floor
