"""The shared-secret gate: local dev passes through untouched, a real
deployment rejects anything that doesn't carry the configured secret."""
import pytest
from fastapi import HTTPException

from app.main import require_shared_secret


def test_unset_secret_allows_every_request(monkeypatch):
    """No DETECTOR_SHARED_SECRET configured means local dev - must not raise
    regardless of what (or whether) an Authorization header is present."""
    monkeypatch.delenv("DETECTOR_SHARED_SECRET", raising=False)
    require_shared_secret(authorization=None)  # must not raise
    require_shared_secret(authorization="Bearer anything")  # must not raise


def test_correct_secret_is_accepted(monkeypatch):
    monkeypatch.setenv("DETECTOR_SHARED_SECRET", "correct-horse-battery-staple")
    require_shared_secret(authorization="Bearer correct-horse-battery-staple")  # must not raise


def test_missing_header_is_rejected_once_a_secret_is_configured(monkeypatch):
    monkeypatch.setenv("DETECTOR_SHARED_SECRET", "correct-horse-battery-staple")
    with pytest.raises(HTTPException) as exc:
        require_shared_secret(authorization=None)
    assert exc.value.status_code == 401


def test_wrong_secret_is_rejected(monkeypatch):
    monkeypatch.setenv("DETECTOR_SHARED_SECRET", "correct-horse-battery-staple")
    with pytest.raises(HTTPException) as exc:
        require_shared_secret(authorization="Bearer wrong-guess")
    assert exc.value.status_code == 401


def test_malformed_header_without_bearer_prefix_is_rejected(monkeypatch):
    monkeypatch.setenv("DETECTOR_SHARED_SECRET", "correct-horse-battery-staple")
    with pytest.raises(HTTPException):
        require_shared_secret(authorization="correct-horse-battery-staple")  # no "Bearer "


def test_empty_configured_secret_behaves_as_unset(monkeypatch):
    """An empty string is falsy - the same as not setting the variable at
    all - so a misconfigured deploy fails open to "no auth", not to a
    silently-unpassable check nobody can satisfy."""
    monkeypatch.setenv("DETECTOR_SHARED_SECRET", "")
    require_shared_secret(authorization=None)  # must not raise
