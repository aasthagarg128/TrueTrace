"""Verifying Google Sign-In tokens.

An ID token from the browser is untrusted input. It is only meaningful after
its signature has been checked against Google's public keys and its claims
checked against our own client id — otherwise anyone could mint a token
claiming to be anyone. Verification uses `google-auth`, Google's own library,
rather than hand-rolled JWT parsing: signature checking is exactly the kind of
code that should not be written from scratch.

Data minimisation is the other half of this module. Google returns name,
email, profile picture and locale. We keep **only `sub`** — the opaque, stable
account identifier — and deliberately discard the rest. TrueTrace's promise is
that it never holds your real name or email; signing in with Google should
reduce your pseudonymity toward Google, not toward us.
"""
from __future__ import annotations

import logging
import os

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

log = logging.getLogger(__name__)

_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

# Small leeway for clock skew between this host and Google.
_CLOCK_SKEW_SECONDS = 10


class GoogleAuthError(Exception):
    """Raised when a Google credential cannot be trusted."""


def is_configured() -> bool:
    """Whether Google Sign-In is available on this deployment.

    Everything degrades cleanly when it is not: the API rejects the endpoint and
    the UI hides the button, rather than showing a control that cannot work.
    """
    return bool(os.getenv("GOOGLE_CLIENT_ID", "").strip())


def client_id() -> str:
    cid = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not cid:
        raise GoogleAuthError("Google Sign-In is not configured on this server.")
    return cid


def verify_credential(credential: str) -> str:
    """Verify a Google ID token and return the opaque subject id.

    Raises GoogleAuthError for anything suspect. The caller must never fall back
    to trusting unverified claims.
    """
    if not credential or not isinstance(credential, str):
        raise GoogleAuthError("Missing Google credential.")

    try:
        claims = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            client_id(),
            clock_skew_in_seconds=_CLOCK_SKEW_SECONDS,
        )
    except GoogleAuthError:
        raise
    except Exception as exc:
        # Covers bad signature, wrong audience, expired token, malformed input.
        log.warning("google credential rejected: %s", exc)
        raise GoogleAuthError("That Google sign-in could not be verified.") from exc

    # verify_oauth2_token checks signature, audience and expiry. It does not
    # guarantee the issuer is Google, so check that explicitly.
    if claims.get("iss") not in _ISSUERS:
        raise GoogleAuthError("That Google sign-in could not be verified.")

    sub = claims.get("sub")
    if not sub:
        raise GoogleAuthError("That Google sign-in could not be verified.")

    # Everything else Google sent — email, name, picture, locale — is dropped
    # here and never reaches the store. This is the whole point.
    return str(sub)
