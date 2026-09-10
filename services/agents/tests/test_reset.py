"""Password reset, and the two accounts paths.

A reset link is a temporary key to someone's account, so these tests pin the
properties that matter: single use, short life, unusable across accounts, and
not usable to discover who has an account.
"""
import time

import pytest

from truetrace.adapters.store import JsonUserStore
from truetrace.core.auth import (
    AuthError,
    hash_password,
    issue_reset_token,
    issue_token,
    normalise_email,
    peek_token_subject,
    validate_email,
    verify_reset_token,
)


@pytest.fixture
def users(tmp_path):
    return JsonUserStore(tmp_path)


# ------------------------------------------------------------ email rules

@pytest.mark.parametrize("good", [
    "a@b.co", "someone@example.com", "first.last+tag@sub.example.org",
])
def test_valid_addresses_accepted(good):
    validate_email(good)


@pytest.mark.parametrize("bad", [
    "", "   ", "no-at-sign", "@example.com", "someone@", "a@b",
    "two@@example.com", "spaces in@example.com", "a@" + "x" * 300 + ".com",
])
def test_invalid_addresses_rejected(bad):
    with pytest.raises(AuthError):
        validate_email(bad)


def test_addresses_are_normalised():
    assert normalise_email("  Someone@Example.COM ") == "someone@example.com"


# --------------------------------------------------------- the two paths

def test_account_without_email_holds_no_contact_details(users):
    user = users.create("anon-person", hash_password("passphrase-here"))
    assert user["email"] is None
    assert users.get_by_email("anything@example.com") is None


def test_account_with_email_is_findable_by_it(users):
    users.create("recoverable", hash_password("passphrase-here"), email="me@example.com")
    found = users.get_by_email("me@example.com")
    assert found is not None and found["username"] == "recoverable"


def test_email_lookup_is_case_insensitive(users):
    users.create("someone", hash_password("passphrase-here"), email="Me@Example.com")
    assert users.get_by_email("me@example.COM") is not None


def test_one_address_cannot_register_twice(users):
    users.create("first", hash_password("passphrase-here"), email="dup@example.com")
    with pytest.raises(ValueError):
        users.create("second", hash_password("passphrase-here"), email="DUP@example.com")


def test_email_is_not_readable_from_the_filesystem_layout(users, tmp_path):
    # A directory listing must not be a list of everyone's address.
    users.create("someone", hash_password("passphrase-here"), email="secret@example.com")
    names = " ".join(p.name for p in tmp_path.iterdir())
    assert "secret" not in names
    assert "example.com" not in names


def test_deleting_an_account_frees_its_address(users):
    user = users.create("temp", hash_password("passphrase-here"), email="reuse@example.com")
    users.delete(user["user_id"])
    assert users.get_by_email("reuse@example.com") is None
    users.create("again", hash_password("passphrase-here"), email="reuse@example.com")


# --------------------------------------------------------- reset tokens

def test_reset_token_roundtrips(users):
    user = users.create("someone", hash_password("original-passphrase"), email="a@b.co")
    token = issue_reset_token(user["user_id"], user["password_hash"])
    assert verify_reset_token(token, user["password_hash"]) == user["user_id"]


def test_reset_token_dies_once_the_password_changes(users):
    """Single use, without storing used tokens anywhere: the signature is bound
    to the hash it was minted against."""
    user = users.create("someone", hash_password("original-passphrase"), email="a@b.co")
    token = issue_reset_token(user["user_id"], user["password_hash"])

    users.set_password(user["user_id"], hash_password("brand-new-passphrase"))
    updated = users.get_by_id(user["user_id"])

    with pytest.raises(AuthError):
        verify_reset_token(token, updated["password_hash"])


def test_reset_token_from_one_account_cannot_reset_another(users):
    a = users.create("alice", hash_password("alice-passphrase"), email="a@example.com")
    b = users.create("mallory", hash_password("mallory-passphrase"), email="b@example.com")
    token = issue_reset_token(a["user_id"], a["password_hash"])
    with pytest.raises(AuthError):
        verify_reset_token(token, b["password_hash"])


def test_expired_reset_token_is_refused(users):
    user = users.create("someone", hash_password("passphrase-here"), email="a@b.co")
    token = issue_reset_token(user["user_id"], user["password_hash"])
    # Rewind past the TTL rather than sleeping through it.
    import truetrace.core.auth as auth
    original = auth.time.time
    try:
        auth.time.time = lambda: original() + auth.RESET_TTL_SECONDS + 60
        with pytest.raises(AuthError):
            verify_reset_token(token, user["password_hash"])
    finally:
        auth.time.time = original


def test_a_session_token_cannot_be_used_to_reset_a_password(users):
    """Guards a privilege escalation: a stolen session must not become the
    ability to change the password and lock the owner out."""
    user = users.create("someone", hash_password("passphrase-here"), email="a@b.co")
    session = issue_token(user["user_id"])
    with pytest.raises(AuthError):
        verify_reset_token(session, user["password_hash"])


@pytest.mark.parametrize("bad", ["", "junk", "a.b.c", "....", "onlyonepart"])
def test_malformed_reset_tokens_are_refused(users, bad):
    user = users.create("someone", hash_password("passphrase-here"), email="a@b.co")
    with pytest.raises(AuthError):
        verify_reset_token(bad, user["password_hash"])


def test_peek_never_authorises_on_its_own(users):
    """peek_token_subject reads an UNVERIFIED claim. A forged token can carry
    any id, which is exactly why callers must still verify."""
    forged = issue_reset_token("u-victim", "some-other-hash")
    assert peek_token_subject(forged) == "u-victim"  # readable...
    user = users.create("victim", hash_password("passphrase-here"))
    with pytest.raises(AuthError):                    # ...but not usable
        verify_reset_token(forged, user["password_hash"])


def test_set_password_on_a_missing_account_is_false(users):
    assert users.set_password("u-nobody", hash_password("x" * 12)) is False
