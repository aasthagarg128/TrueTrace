"""Google Sign-In must fail closed.

An ID token arrives from the browser and is therefore attacker-controlled. The
only thing standing between a forged token and someone else's cases is
signature verification, so these tests exist to make sure it cannot be
accidentally bypassed or made permissive.
"""
import base64
import json
import os

import pytest

from truetrace.adapters.store import JsonUserStore
from truetrace.core.google_auth import (
    GoogleAuthError,
    client_id,
    is_configured,
    verify_credential,
)

CLIENT_ID = "test-client.apps.googleusercontent.com"


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", CLIENT_ID)


@pytest.fixture
def unconfigured(monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)


def _b64(d: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")


def forged_token(**overrides) -> str:
    """A structurally valid JWT with a plausible payload and a junk signature.

    This is the shape of the realistic attack: everything looks right except the
    one part that requires Google's private key.
    """
    payload = {
        "iss": "https://accounts.google.com",
        "sub": "1234567890",
        "aud": CLIENT_ID,
        "email": "victim@example.com",
        "exp": 9999999999,
    }
    payload.update(overrides)
    return f"{_b64({'alg': 'RS256', 'typ': 'JWT'})}.{_b64(payload)}.not-a-real-signature"


def test_disabled_when_no_client_id(unconfigured):
    assert is_configured() is False
    with pytest.raises(GoogleAuthError):
        client_id()


def test_enabled_when_client_id_present(configured):
    assert is_configured() is True
    assert client_id() == CLIENT_ID


def test_forged_signature_is_rejected(configured):
    # The whole security model in one assertion: a well-formed token with the
    # right issuer and audience is still worthless without Google's signature.
    with pytest.raises(GoogleAuthError):
        verify_credential(forged_token())


@pytest.mark.parametrize(
    "bad",
    ["", "   ", "abc", "abc.def", "a.b.c.d", "....", None, 12345, {"credential": "x"}],
)
def test_malformed_credentials_are_rejected(configured, bad):
    with pytest.raises(GoogleAuthError):
        verify_credential(bad)  # type: ignore[arg-type]


def test_wrong_audience_is_rejected(configured):
    with pytest.raises(GoogleAuthError):
        verify_credential(forged_token(aud="someone-elses-app.apps.googleusercontent.com"))


def test_wrong_issuer_is_rejected(configured):
    with pytest.raises(GoogleAuthError):
        verify_credential(forged_token(iss="https://evil.example.com"))


def test_expired_token_is_rejected(configured):
    with pytest.raises(GoogleAuthError):
        verify_credential(forged_token(exp=1))


def test_verification_required_even_when_unconfigured(unconfigured):
    # Must not silently succeed just because no client id is set.
    with pytest.raises(GoogleAuthError):
        verify_credential(forged_token())


# ---------------------------------------------------------------- store

def test_google_account_stores_no_personal_data(tmp_path):
    store = JsonUserStore(tmp_path)
    user = store.create_google_user("google-subject-9876")

    blob = json.dumps(user)
    # Google hands over name, email and picture. None of it may land here.
    for leaked in ("@", "email", "name", "picture", "given_name", "locale"):
        assert leaked not in blob.lower() or leaked == "name"  # "username" contains "name"
    assert "@" not in blob
    assert user["auth_provider"] == "google"
    # The derived handle must not embed the Google subject id either.
    assert "9876" not in user["username"]


def test_google_account_is_found_again_by_subject(tmp_path):
    store = JsonUserStore(tmp_path)
    created = store.create_google_user("subject-abc")
    found = store.get_by_google_sub("subject-abc")
    assert found is not None
    assert found["user_id"] == created["user_id"]


def test_repeat_google_signin_does_not_duplicate_accounts(tmp_path):
    store = JsonUserStore(tmp_path)
    a = store.create_google_user("subject-xyz")
    b = store.create_google_user("subject-xyz")
    assert a["user_id"] == b["user_id"]


def test_unknown_subject_has_no_account(tmp_path):
    store = JsonUserStore(tmp_path)
    assert store.get_by_google_sub("never-seen") is None


def test_google_account_cannot_be_used_with_password_login(tmp_path):
    from truetrace.core.auth import verify_password

    store = JsonUserStore(tmp_path)
    user = store.create_google_user("subject-pw")
    # An empty stored hash must never validate, including against an empty input.
    assert verify_password("", user["password_hash"]) is False
    assert verify_password("anything", user["password_hash"]) is False
