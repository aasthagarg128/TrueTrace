"""Envelope encryption for evidence packages.

AES-256-GCM, because evidence needs both confidentiality and tamper-evidence:
GCM's authentication tag means a modified package fails to decrypt rather than
decrypting to something subtly wrong. That property is the whole point when the
artifact may later be handed to a platform or a lawyer.

File layout:  magic(6) || nonce(12) || ciphertext+tag
The manifest SHA-256 is bound in as associated data, so a package cannot be
re-pointed at a different manifest without detection.
"""
from __future__ import annotations

import base64
import os
from dataclasses import dataclass

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC = b"TTEV1\x00"
NONCE_BYTES = 12
KEY_BYTES = 32


class EvidenceKeyError(RuntimeError):
    pass


class EvidenceIntegrityError(RuntimeError):
    """Raised when a package fails authentication - treat as tampered."""


def generate_key() -> str:
    """Base64 key for EVIDENCE_KEY. Not called at runtime; used to bootstrap."""
    return base64.b64encode(os.urandom(KEY_BYTES)).decode()


def load_key(raw: str | None = None) -> bytes:
    raw = raw if raw is not None else os.getenv("EVIDENCE_KEY", "")
    if not raw:
        raise EvidenceKeyError(
            "EVIDENCE_KEY is not set. Generate one with: "
            "python -c \"from truetrace.core.crypto import generate_key; print(generate_key())\""
        )
    try:
        key = base64.b64decode(raw, validate=True)
    except Exception as exc:
        raise EvidenceKeyError(f"EVIDENCE_KEY is not valid base64: {exc}") from exc
    if len(key) != KEY_BYTES:
        raise EvidenceKeyError(
            f"EVIDENCE_KEY must decode to {KEY_BYTES} bytes, got {len(key)}"
        )
    return key


@dataclass(frozen=True)
class Sealed:
    blob: bytes
    nonce: bytes


def seal(plaintext: bytes, manifest_sha256: str, key: bytes | None = None) -> Sealed:
    key = key or load_key()
    nonce = os.urandom(NONCE_BYTES)
    ct = AESGCM(key).encrypt(nonce, plaintext, manifest_sha256.encode())
    return Sealed(blob=MAGIC + nonce + ct, nonce=nonce)


def unseal(blob: bytes, manifest_sha256: str, key: bytes | None = None) -> bytes:
    key = key or load_key()
    if not blob.startswith(MAGIC):
        raise EvidenceIntegrityError("not a TrueTrace evidence package")
    nonce = blob[len(MAGIC) : len(MAGIC) + NONCE_BYTES]
    ct = blob[len(MAGIC) + NONCE_BYTES :]
    try:
        return AESGCM(key).decrypt(nonce, ct, manifest_sha256.encode())
    except InvalidTag as exc:
        raise EvidenceIntegrityError(
            "package failed authentication: it was modified, the manifest hash "
            "does not match, or the key is wrong"
        ) from exc
