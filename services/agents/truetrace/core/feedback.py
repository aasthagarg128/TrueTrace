"""Product feedback: a lightweight, append-only record of what users tell us.

Deliberately separate from the case store rather than bolted onto it. Feedback
about the product is not sensitive in the way a case is — it has no video URL,
no evidence hash, no reporter identity unless someone chooses to leave one —
so it does not need encryption or per-owner access control. It does follow the
same backend-selection pattern as cases (local JSON by default, Firestore when
configured) so a small deployment and a cloud one both work with no code change.

Anonymous by default: `contact` is optional and never required to submit.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger(__name__)

MAX_MESSAGE_LEN = 4000
_lock = threading.Lock()


class FeedbackError(Exception):
    pass


def validate(message: str, rating: int | None, contact: str | None) -> None:
    if not message or not message.strip():
        raise FeedbackError("Feedback message cannot be empty.")
    if len(message) > MAX_MESSAGE_LEN:
        raise FeedbackError(f"Feedback is limited to {MAX_MESSAGE_LEN} characters.")
    if rating is not None and not (1 <= rating <= 5):
        raise FeedbackError("Rating must be between 1 and 5.")
    # A loose shape check only - this is a contact hint for a possible follow-up,
    # not an authenticated identity, so it is never required to be well-formed.
    if contact and len(contact) > 320:
        raise FeedbackError("Contact detail is too long.")


def _local_path() -> Path:
    root = Path(os.getenv("FEEDBACK_STORE", "data/feedback"))
    root.mkdir(parents=True, exist_ok=True)
    return root


def save(
    message: str,
    *,
    rating: int | None = None,
    contact: str | None = None,
    page: str | None = None,
    owner: str | None = None,
) -> str:
    """Store one feedback submission and return its id.

    Never raises on a storage failure - feedback that fails to persist should
    not turn into a 500 for someone who just tried to be helpful. It logs
    loudly instead, the same fail-soft shape as the Gemini and Firestore paths.
    """
    validate(message, rating, contact)

    record = {
        "feedback_id": f"fb-{uuid.uuid4().hex[:12]}",
        "message": message.strip(),
        "rating": rating,
        "contact": contact.strip() if contact else None,
        "page": page,
        "owner": owner,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }

    backend = os.getenv("CASE_BACKEND", "json").strip().lower()
    if backend == "firestore":
        try:
            from google.cloud import firestore

            client = firestore.Client(project=os.getenv("GOOGLE_CLOUD_PROJECT") or None)
            collection = os.getenv("FEEDBACK_COLLECTION", "feedback")
            client.collection(collection).document(record["feedback_id"]).set(record)
            return record["feedback_id"]
        except Exception as exc:
            log.error(
                "CASE_BACKEND=firestore but writing feedback failed (%s); "
                "falling back to local JSON storage", exc,
            )

    with _lock:
        path = _local_path() / f"{record['feedback_id']}.json"
        path.write_text(json.dumps(record, indent=2), encoding="utf-8")
    return record["feedback_id"]
