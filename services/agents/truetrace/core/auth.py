"""Pseudonymous accounts: password hashing and signed session tokens.

This product's users may be in danger from the person who harmed them, so the
account layer is written defensively even at MVP:

  - Passwords are hashed with scrypt (memory-hard, so GPU cracking is expensive),
    a fresh 16-byte salt each, and verified in constant time.
  - Login failures are indistinguishable between "no such user" and "wrong
    password", so the endpoint cannot be used to discover who has an account.
    For a product about non-consensual imagery, confirming that a particular
    handle exists is itself a leak.
  - Tokens are HMAC-signed and expire. Nothing sensitive is stored in them -
    only a user id and an expiry.
  - An email address is OPTIONAL and exists only so a forgotten password can
    be recovered. Accounts created without one hold no contact details at all,
    and that path stays the recommended one. We never ask for a phone number,
    real name, or date of birth on either path.

Everything here is stdlib. No secret ever leaves this process.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time

# scrypt parameters. n=2**15 keeps a single verification comfortably under
# ~100ms on a laptop CPU while making bulk offline cracking costly.
_SCRYPT_N = 2**15
_SCRYPT_R = 8
_SCRYPT_P = 1
_SALT_BYTES = 16
_KEY_LEN = 32
# OpenSSL defaults maxmem to 32 MiB, which is just under what n=2**15, r=8
# needs (128 * n * r ~= 32 MiB plus overhead). Without this it raises
# "memory limit exceeded" rather than silently weakening the hash.
_SCRYPT_MAXMEM = 96 * 1024 * 1024

TOKEN_TTL_SECONDS = 60 * 60 * 12  # 12 hours

USERNAME_RE = re.compile(r"^[a-zA-Z0-9._-]{3,32}$")
MIN_PASSWORD_LEN = 8

# Deliberately permissive. Strict RFC-5322 validation rejects addresses that
# work fine, and the only thing that actually proves an address is real is
# sending to it. This catches typos, not adversaries.
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
MAX_EMAIL_LEN = 254  # RFC 5321

# A reset link is a temporary key to someone's account. Short-lived on purpose:
# a link sitting in an inbox is a standing risk for a user whose device may be
# monitored by the person who harmed them.
RESET_TTL_SECONDS = 30 * 60


class AuthError(Exception):
    """Raised for any authentication failure. Deliberately uninformative."""


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


# ---------------------------------------------------------------- passwords

def hash_password(password: str) -> str:
    """Return a self-describing hash string; parameters travel with the hash so
    they can be raised later without invalidating existing accounts."""
    salt = os.urandom(_SALT_BYTES)
    key = hashlib.scrypt(
        password.encode("utf-8"), salt=salt,
        n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=_KEY_LEN,
        maxmem=_SCRYPT_MAXMEM,
    )
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${_b64e(salt)}${_b64e(key)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt_b64, key_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        key = hashlib.scrypt(
            password.encode("utf-8"), salt=_b64d(salt_b64),
            n=int(n), r=int(r), p=int(p), dklen=len(_b64d(key_b64)),
            maxmem=_SCRYPT_MAXMEM,
        )
    except Exception:
        return False
    # Constant time: never let timing reveal how much of the hash matched.
    return hmac.compare_digest(key, _b64d(key_b64))


def validate_username(username: str) -> None:
    if not USERNAME_RE.match(username or ""):
        raise AuthError(
            "Username must be 3-32 characters, using letters, numbers, dot, "
            "underscore or hyphen."
        )


def validate_password(password: str) -> None:
    if len(password or "") < MIN_PASSWORD_LEN:
        raise AuthError(f"Password must be at least {MIN_PASSWORD_LEN} characters.")


def normalise_email(email: str) -> str:
    """Lowercase and trim. Stored normalised so one address cannot register twice
    under different capitalisation."""
    return (email or "").strip().lower()


def validate_email(email: str) -> None:
    email = normalise_email(email)
    if not email or not EMAIL_RE.match(email) or len(email) > MAX_EMAIL_LEN:
        raise AuthError("That does not look like an email address.")


# ------------------------------------------------------------------- tokens

def _secret() -> bytes:
    raw = os.getenv("AUTH_SECRET", "")
    if not raw:
        # Generated per process if unset: sessions do not survive a restart,
        # which is inconvenient but never insecure. Set AUTH_SECRET to persist.
        raw = _PROCESS_SECRET
    return raw.encode("utf-8")


_PROCESS_SECRET = secrets.token_urlsafe(32)


def issue_token(user_id: str, ttl: int = TOKEN_TTL_SECONDS) -> str:
    payload = {"sub": user_id, "exp": int(time.time()) + ttl}
    body = _b64e(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(_secret(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{_b64e(sig)}"


def verify_token(token: str) -> str:
    """Return the user id, or raise AuthError. Never trust an unverified token."""
    try:
        body, sig = token.split(".")
        expected = hmac.new(_secret(), body.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64d(sig)):
            raise AuthError("invalid session")
        payload = json.loads(_b64d(body))
    except AuthError:
        raise
    except Exception as exc:
        raise AuthError("invalid session") from exc

    if int(payload.get("exp", 0)) < time.time():
        raise AuthError("session expired")
    sub = payload.get("sub")
    if not sub:
        raise AuthError("invalid session")
    return str(sub)


# ------------------------------------------------------- password reset

def issue_reset_token(user_id: str, password_hash: str) -> str:
    """A single-use, short-lived token for resetting a password.

    The current password hash is mixed into the signature, so the token stops
    working the moment the password changes. That makes it single-use without
    needing to store used tokens anywhere, and it means an old link found in an
    inbox months later is already dead.
    """
    payload = {"sub": user_id, "exp": int(time.time()) + RESET_TTL_SECONDS, "typ": "reset"}
    body = _b64e(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(_secret() + password_hash.encode(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{_b64e(sig)}"


def verify_reset_token(token: str, password_hash: str) -> str:
    """Return the user id, or raise. `password_hash` must be the account's
    CURRENT hash - a token minted against an older one no longer verifies."""
    try:
        body, sig = token.split(".")
        expected = hmac.new(
            _secret() + password_hash.encode(), body.encode(), hashlib.sha256
        ).digest()
        if not hmac.compare_digest(expected, _b64d(sig)):
            raise AuthError("This reset link is no longer valid.")
        payload = json.loads(_b64d(body))
    except AuthError:
        raise
    except Exception as exc:
        raise AuthError("This reset link is no longer valid.") from exc

    if payload.get("typ") != "reset":
        # A session token must never be usable to change a password.
        raise AuthError("This reset link is no longer valid.")
    if int(payload.get("exp", 0)) < time.time():
        raise AuthError("This reset link has expired. Request a new one.")
    sub = payload.get("sub")
    if not sub:
        raise AuthError("This reset link is no longer valid.")
    return str(sub)


def peek_token_subject(token: str) -> str | None:
    """Read the claimed subject WITHOUT verifying anything.

    Named to be impossible to misuse by accident. Reset verification needs the
    account's current password hash to check the signature, and finding that
    account needs the id — so the id must be read before it can be trusted. The
    caller MUST then call verify_reset_token and compare. Never authorise
    anything on the strength of this value alone.
    """
    try:
        body = token.split(".")[0]
        return json.loads(_b64d(body)).get("sub")
    except Exception:
        return None
