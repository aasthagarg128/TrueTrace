"""What Gemini is allowed to see, and what it is allowed to decide.

Google's free Gemini tier may be human-reviewed and used for training. For a
product handling non-consensual imagery, an accidental URL or frame in a prompt
is a serious leak, so these tests pin the payload contract rather than trusting
the calling code to stay careful.
"""
import pytest

from truetrace.core.explain import (
    ALLOWED_SIGNAL_KEYS,
    ExplainError,
    assert_safe,
    build_payload,
    explain,
    is_configured,
)

# A realistic analysis dict, including the fields that must never travel.
ANALYSIS = {
    "band": "flagged",
    "score": 0.93,
    "frames_submitted": 16,
    "frames_with_face": 14,
    "frames_scored": 14,
    "flagged_fraction": 0.36,
    "dispersion": 0.19,
    "model_version": "prithivMLmods/deepfake-detector-model-v1@c5cb24c",
    "elapsed_ms": 8100,
    "limitations": ["not a determination"],
    # the dangerous ones
    "source_url": "https://example.com/watch?v=abc123",
    "case_id": "case-9050dac31fdd",
    "owner": "u-44b773cc9267",
    "preview_b64": "/9j/4AAQSkZJRgABAQ",
    "video_sha256": "d06a7ade4f9df176e4250791a31d8c180eb812b3cba133ef553b0d273e61ae50",
}

LIMITATIONS = [
    "This is an automated screening signal, not a determination.",
    "Roughly 23% of the videos this screening flags are in fact authentic.",
]


def test_payload_contains_only_allowlisted_keys():
    payload = build_payload(ANALYSIS)
    assert set(payload).issubset(ALLOWED_SIGNAL_KEYS)


@pytest.mark.parametrize(
    "leaky", ["source_url", "case_id", "owner", "preview_b64", "video_sha256", "model_version"]
)
def test_sensitive_fields_never_reach_the_payload(leaky):
    assert leaky not in build_payload(ANALYSIS)


def test_payload_values_do_not_contain_content():
    blob = repr(build_payload(ANALYSIS))
    for token in ("http", "case-", "u-4", "/9j/", "d06a7ade"):
        assert token not in blob


def test_allowlist_survives_new_analysis_fields():
    # The failure mode this guards: someone adds a field to the analysis dict
    # months from now and it silently starts being sent to a third party.
    polluted = {**ANALYSIS, "uploader_name": "a real person", "thumbnail_url": "https://x"}
    payload = build_payload(polluted)
    assert "uploader_name" not in payload
    assert "thumbnail_url" not in payload


def test_peak_score_is_renamed_not_dropped():
    payload = build_payload(ANALYSIS)
    assert payload["peak_score"] == 0.93
    assert "score" not in payload  # the ambiguous name must not travel


def test_inconclusive_analysis_yields_no_peak_score():
    payload = build_payload({**ANALYSIS, "score": None})
    assert payload.get("peak_score") is None


@pytest.mark.parametrize(
    "prompt",
    [
        "look at https://example.com/x",
        "http://plain.example",
        "the case-9050dac31fdd result",
        "user u-44b773cc9267",
        "reach me at someone@example.com",
        "sha256 d06a7ade",
        "image data /9j/4AAQ",
    ],
)
def test_unsafe_prompts_are_refused(prompt):
    with pytest.raises(ExplainError):
        assert_safe(prompt)


def test_clean_prompt_passes():
    assert_safe("band: flagged\nframes_scored: 14\ndispersion: 0.19") is None


def test_unconfigured_returns_none_rather_than_failing(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert is_configured() is False
    # A missing key must degrade to template text, never raise into the pipeline.
    assert explain(ANALYSIS, LIMITATIONS) is None


def test_api_failure_degrades_to_none(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "not-a-real-key")
    # No network here; the SDK will fail. The contract is that it returns None
    # so the case still completes with its template explanation.
    assert explain(ANALYSIS, LIMITATIONS, timeout_s=2) is None
