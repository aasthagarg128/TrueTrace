"""Storage backends, selected at startup.

`CASE_BACKEND=firestore` moves case data to Google Cloud with no caller changes,
because both implementations satisfy the same `CaseStore` protocol. The default
stays local JSON so the project runs with no cloud account at all.
"""
from __future__ import annotations

import logging
import os

from .store import CaseStore, JsonCaseStore, JsonUserStore

log = logging.getLogger(__name__)


def build_case_store() -> CaseStore:
    backend = os.getenv("CASE_BACKEND", "json").strip().lower()

    if backend == "firestore":
        try:
            from .firestore_store import FirestoreCaseStore

            store = FirestoreCaseStore(
                collection=os.getenv("FIRESTORE_COLLECTION", "cases")
            )
            log.info("case storage: Firestore")
            return store
        except Exception as exc:
            # A misconfigured cloud backend must not take the service down, and
            # must not silently look like it worked either.
            log.error(
                "CASE_BACKEND=firestore but Firestore is unavailable (%s); "
                "falling back to local JSON storage", exc,
            )

    log.info("case storage: local JSON")
    return JsonCaseStore(os.getenv("CASE_STORE", "data/cases"))


__all__ = ["CaseStore", "JsonCaseStore", "JsonUserStore", "build_case_store"]
