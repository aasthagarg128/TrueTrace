"""Firestore-backed case storage.

Implements the same `CaseStore` protocol as `JsonCaseStore`, so switching is one
environment variable and no caller changes. Firestore is free on Firebase's
Spark plan (1 GiB stored, 50k reads and 20k writes a day) with no billing
account, which is why it is the cloud database this project targets.

Two Firestore-specific hazards are handled here rather than left to bite later:

  1. **The 1 MiB document limit.** A case carries a base64 preview frame, which
     can be a couple of hundred kilobytes. That fits, but a larger frame or a
     long audit trail would eventually not. Oversized previews are dropped with
     a warning rather than failing the write — losing a thumbnail is recoverable,
     losing the case record is not.

  2. **Audit growth.** The audit trail is an array on the document. Firestore
     has no server-side append for arrays of objects that also returns the
     document, so this reads-modifies-writes. That is fine at this scale and
     wrong at a much larger one; the note is here so the tradeoff is visible.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

log = logging.getLogger(__name__)

# Firestore's hard limit is 1 MiB per document. Stay well under it: the rest of
# the case record, plus Firestore's own overhead, shares the same budget.
_MAX_PREVIEW_CHARS = 400_000


class FirestoreCaseStore:
    """Cases in Firestore. Credentials come from Application Default
    Credentials, so `gcloud auth application-default login` or a service account
    key in GOOGLE_APPLICATION_CREDENTIALS is enough — nothing is hard-coded."""

    def __init__(self, collection: str = "cases", project: str | None = None) -> None:
        from google.cloud import firestore  # imported lazily: optional backend

        self._db = firestore.Client(project=project or os.getenv("GOOGLE_CLOUD_PROJECT"))
        self._collection = collection

    def _doc(self, case_id: str):
        return self._db.collection(self._collection).document(case_id)

    @staticmethod
    def _trim(case: dict) -> dict:
        preview = case.get("preview_b64")
        if preview and len(preview) > _MAX_PREVIEW_CHARS:
            log.warning(
                "preview for %s is %d chars, dropping it to stay under the "
                "Firestore document limit", case.get("case_id"), len(preview),
            )
            case = {**case, "preview_b64": None, "preview_dropped": True}
        return case

    def create(self, case: dict) -> str:
        case.setdefault("audit", [])
        self._doc(case["case_id"]).set(self._trim(case))
        return case["case_id"]

    def get(self, case_id: str) -> dict | None:
        snap = self._doc(case_id).get()
        return snap.to_dict() if snap.exists else None

    def update(self, case_id: str, patch: dict) -> None:
        # set(merge=True) rather than update(): update() raises if the document
        # is missing, and a pipeline racing a deleted case should not crash.
        self._doc(case_id).set(self._trim(patch), merge=True)

    def iter_cases(self):
        """Every case, for maintenance work like retention. Streams rather than
        fetching everything at once."""
        for doc in self._db.collection(self._collection).stream():
            data = doc.to_dict()
            if data:
                yield data

    def list_for_owner(self, owner: str) -> list[dict]:
        from google.cloud.firestore_v1 import FieldFilter

        query = (
            self._db.collection(self._collection)
            .where(filter=FieldFilter("owner", "==", owner))
            .order_by("created_at", direction="DESCENDING")
            .limit(200)
        )
        return [d.to_dict() for d in query.stream()]

    def append_audit(self, case_id: str, action: str, detail: str = "") -> None:
        entry = {
            "at": datetime.now(timezone.utc).isoformat(),
            "action": action,
            "detail": detail,
        }
        snap = self._doc(case_id).get()
        if not snap.exists:
            return
        audit = (snap.to_dict() or {}).get("audit", [])
        audit.append(entry)
        self._doc(case_id).set({"audit": audit}, merge=True)
