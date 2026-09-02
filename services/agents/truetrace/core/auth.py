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
  - We never ask for, store, or accept an email, phone number, or real name.

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
