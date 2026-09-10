"""Feedback storage: anonymous by default, never blocks on a broken backend."""
import json

import pytest

from truetrace.core.feedback import FeedbackError, save, validate


def test_empty_message_is_rejected():
    with pytest.raises(FeedbackError):
        validate("   ", None, None)


def test_message_over_limit_is_rejected():
    with pytest.raises(FeedbackError):
        validate("x" * 4001, None, None)


@pytest.mark.parametrize("rating", [0, 6, -1])
def test_rating_out_of_range_is_rejected(rating):
    with pytest.raises(FeedbackError):
        validate("fine", rating, None)


@pytest.mark.parametrize("rating", [1, 3, 5, None])
def test_valid_ratings_pass(rating):
    validate("fine", rating, None)  # must not raise


def test_save_writes_a_local_record_with_no_owner_required(tmp_path, monkeypatch):
    monkeypatch.delenv("CASE_BACKEND", raising=False)
    monkeypatch.setenv("FEEDBACK_STORE", str(tmp_path))

    fid = save("This helped a lot, thank you.", rating=5)

    files = list(tmp_path.glob("*.json"))
    assert len(files) == 1
    record = json.loads(files[0].read_text(encoding="utf-8"))
    assert record["feedback_id"] == fid
    assert record["message"] == "This helped a lot, thank you."
    assert record["rating"] == 5
    assert record["contact"] is None
    assert record["owner"] is None
    assert "submitted_at" in record


def test_save_attaches_owner_when_signed_in(tmp_path, monkeypatch):
    monkeypatch.delenv("CASE_BACKEND", raising=False)
    monkeypatch.setenv("FEEDBACK_STORE", str(tmp_path))

    save("Please add dark mode.", owner="u-abc123")

    record = json.loads(next(tmp_path.glob("*.json")).read_text(encoding="utf-8"))
    assert record["owner"] == "u-abc123"


def test_contact_is_optional_and_never_required(tmp_path, monkeypatch):
    monkeypatch.delenv("CASE_BACKEND", raising=False)
    monkeypatch.setenv("FEEDBACK_STORE", str(tmp_path))

    fid = save("No complaints.")  # no contact, no rating, no owner
    assert fid.startswith("fb-")


def test_message_is_trimmed_before_storage(tmp_path, monkeypatch):
    monkeypatch.delenv("CASE_BACKEND", raising=False)
    monkeypatch.setenv("FEEDBACK_STORE", str(tmp_path))

    save("  extra spaces  ")
    record = json.loads(next(tmp_path.glob("*.json")).read_text(encoding="utf-8"))
    assert record["message"] == "extra spaces"


def test_firestore_failure_falls_back_to_local_json(tmp_path, monkeypatch):
    """Same fail-soft contract as the case store: a broken cloud backend must
    not turn feedback into a 500 for someone who just tried to be helpful.

    Forced explicitly rather than relying on absent credentials -- this
    machine has real ADC configured (see the Firestore migration work), so
    without this the "failure" path would silently write to a real project.
    """
    from google.cloud import firestore

    def _boom(*_a, **_kw):
        raise RuntimeError("no credentials in this test")

    monkeypatch.setattr(firestore, "Client", _boom)
    monkeypatch.setenv("CASE_BACKEND", "firestore")
    monkeypatch.setenv("FEEDBACK_STORE", str(tmp_path))

    fid = save("Feedback while the cloud path is down.")

    files = list(tmp_path.glob("*.json"))
    assert len(files) == 1
    assert files[0].name == f"{fid}.json"
