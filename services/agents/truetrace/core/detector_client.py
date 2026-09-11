"""HTTP client for the detector service.

Sends frames only. Never the source video, never the URL, never a user id - the
detector has no need for them, and keeping them out limits how far the most
sensitive material in the system can travel.

In production the detector has no reason to be reachable by anything other
than this API, so every request carries a shared secret (DETECTOR_SHARED_SECRET)
when one is configured. A plain shared secret, not a cloud-provider identity
token: this project has already moved hosting once, and a portable check
beats one tied to a specific platform's metadata server. Locally, with
nothing configured, requests go out with no auth header, same as always.
"""
from __future__ import annotations

import os

import httpx

from .frames import SampledFrame


class DetectorClient:
    def __init__(self, base_url: str, timeout: float = 120.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        secret = os.getenv("DETECTOR_SHARED_SECRET", "")
        return {"Authorization": f"Bearer {secret}"} if secret else {}

    def health(self) -> dict:
        r = httpx.get(f"{self._base_url}/healthz", headers=self._headers(), timeout=10)
        r.raise_for_status()
        return r.json()

    def score(self, frames: list[SampledFrame]) -> dict:
        files = [
            ("frames", (f"frame_{f.index:03d}.jpg", f.jpeg, "image/jpeg")) for f in frames
        ]
        r = httpx.post(
            f"{self._base_url}/score", files=files, headers=self._headers(), timeout=self._timeout
        )
        r.raise_for_status()
        return r.json()

    def verify_identity(self, reference_photo: bytes, frames: list[SampledFrame]) -> dict:
        """Does `reference_photo` match a face in any of `frames`?

        Sent alongside the same frame set already used for `/score` - the
        reference photo is never written to disk on this side either; it
        exists only as bytes in this process's memory for the duration of
        this one HTTP call.
        """
        files = [("reference", ("reference.jpg", reference_photo, "image/jpeg"))]
        files += [
            ("frames", (f"frame_{f.index:03d}.jpg", f.jpeg, "image/jpeg")) for f in frames
        ]
        r = httpx.post(
            f"{self._base_url}/identity/verify",
            files=files,
            headers=self._headers(),
            timeout=self._timeout,
        )
        r.raise_for_status()
        return r.json()
