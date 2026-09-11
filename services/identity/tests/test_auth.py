"""The shared-secret gate: local dev passes through untouched, a real
deployment rejects anything that doesn't carry the configured secret.

Mirrors services/detector/tests/test_auth.py - see that file's
require_shared_secret docstring for why this isn't a shared import between
the two services."""
import pytest
from fastapi import HTTPException

from app.main import require_shared_secret


def test_unset_secret_allows_every_request(monkeypatch):
    monkeypatch.delenv("IDENTITY_SHARED_SECRET", raising=False)
    require_shared_secret(authorization=None)
    require_shared_secret(authorization="Bearer anything")


def test_correct_secret_is_accepted(monkeypatch):
    monkeypatch.setenv("IDENTITY_SHARED_SECRET", "correct-horse-battery-staple")
    require_shared_secret(authorization="Bearer correct-horse-battery-staple")


def test_missing_header_is_rejected_once_a_secret_is_configured(monkeypatch):
    monkeypatch.setenv("IDENTITY_SHARED_SECRET", "correct-horse-battery-staple")
    with pytest.raises(HTTPException) as exc:
        require_shared_secret(authorization=None)
    assert exc.value.status_code == 401


def test_wrong_secret_is_rejected(monkeypatch):
    monkeypatch.setenv("IDENTITY_SHARED_SECRET", "correct-horse-battery-staple")
    with pytest.raises(HTTPException) as exc:
        require_shared_secret(authorization="Bearer wrong-guess")
    assert exc.value.status_code == 401


def test_malformed_header_without_bearer_prefix_is_rejected(monkeypatch):
    monkeypatch.setenv("IDENTITY_SHARED_SECRET", "correct-horse-battery-staple")
    with pytest.raises(HTTPException):
        require_shared_secret(authorization="correct-horse-battery-staple")


def test_empty_configured_secret_behaves_as_unset(monkeypatch):
    monkeypatch.setenv("IDENTITY_SHARED_SECRET", "")
    require_shared_secret(authorization=None)
