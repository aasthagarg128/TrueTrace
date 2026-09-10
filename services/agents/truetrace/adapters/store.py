"""Case storage behind a narrow interface.

`JsonCaseStore` writes to local disk so the whole product runs with no cloud
account and no cost. `FirestoreCaseStore` implements the same Protocol and is
the only thing that needs to change to move to Google Cloud - no caller does.
"""
from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol


class CaseStore(Protocol):
    def create(self, case: dict) -> str: ...
    def get(self, case_id: str) -> dict | None: ...
    def update(self, case_id: str, patch: dict) -> None: ...
    def list_for_owner(self, owner: str) -> list[dict]: ...
    def append_audit(self, case_id: str, action: str, detail: str = "") -> None: ...


class JsonCaseStore:
    """One JSON file per case. A lock keeps concurrent background workers from
    interleaving writes; this is single-node by design, which is all the local
    build needs."""

    def __init__(self, root: str | Path = "data/cases") -> None:
        self._root = Path(root)
        self._root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _path(self, case_id: str) -> Path:
        # Case ids are generated internally, but never let one escape the root.
        safe = "".join(c for c in case_id if c.isalnum() or c in "-_")
        return self._root / f"{safe}.json"

    def create(self, case: dict) -> str:
        with self._lock:
            case.setdefault("audit", [])
            self._path(case["case_id"]).write_text(
                json.dumps(case, indent=2, default=str), encoding="utf-8"
            )
        return case["case_id"]

    def get(self, case_id: str) -> dict | None:
        p = self._path(case_id)
        if not p.exists():
            return None
        return json.loads(p.read_text(encoding="utf-8"))

    def update(self, case_id: str, patch: dict) -> None:
        with self._lock:
            current = self.get(case_id) or {}
            current.update(patch)
            self._path(case_id).write_text(
                json.dumps(current, indent=2, default=str), encoding="utf-8"
            )

    def list_for_owner(self, owner: str) -> list[dict]:
        out = []
        for p in sorted(self._root.glob("*.json"), reverse=True):
            try:
                c = json.loads(p.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            if c.get("owner") == owner:
                out.append(c)
        return out

    def append_audit(self, case_id: str, action: str, detail: str = "") -> None:
        with self._lock:
            current = self.get(case_id)
            if current is None:
                return
            current.setdefault("audit", []).append(
                {
                    "at": datetime.now(timezone.utc).isoformat(),
                    "action": action,
                    "detail": detail,
                }
            )
            self._path(case_id).write_text(
                json.dumps(current, indent=2, default=str), encoding="utf-8"
            )


class JsonUserStore:
    """Pseudonymous accounts on local disk.

    Usernames are stored lowercased for lookup so `Alex` and `alex` cannot both
    be registered — near-identical handles are a real impersonation vector in a
    product where people are already being impersonated.
    """

    def __init__(self, root: str | Path = "data/users") -> None:
        self._root = Path(root)
        self._root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _path(self, key: str) -> Path:
        safe = "".join(c for c in key.lower() if c.isalnum() or c in "._-")
        return self._root / f"{safe}.json"

    def exists(self, username: str) -> bool:
        return self._path(username).exists()

    def create(self, username: str, password_hash: str) -> dict:
        with self._lock:
            p = self._path(username)
            if p.exists():
                raise ValueError("username taken")
            user = {
                "user_id": f"u-{uuid.uuid4().hex[:12]}",
                "username": username,
                "password_hash": password_hash,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            p.write_text(json.dumps(user, indent=2), encoding="utf-8")
            (self._root / f"{user['user_id']}.idx").write_text(
                username.lower(), encoding="utf-8"
            )
            return user

    def get_by_username(self, username: str) -> dict | None:
        p = self._path(username)
        if not p.exists():
            return None
        return json.loads(p.read_text(encoding="utf-8"))

    def get_by_id(self, user_id: str) -> dict | None:
        """Resolve a user id, rebuilding the index if it has gone missing.

        The id index is a cache, not the record. Treating it as authoritative
        produced a genuinely nasty failure: sign-in succeeded (it reads the
        account file by username) and then every authenticated request returned
        401 "not signed in", because only the id lookup was broken. Anyone
        debugging that starts by suspecting tokens, which is the wrong place.

        So a miss falls back to scanning the account files and rewrites the
        index. Scanning is fine at this scale, and the Firestore backend has no
        equivalent problem because it queries by field.
        """
        idx = self._root / f"{user_id}.idx"
        if idx.exists():
            user = self.get_by_username(idx.read_text(encoding="utf-8").strip())
            if user is not None:
                return user
            # Index points at an account that no longer exists.
            idx.unlink(missing_ok=True)

        for path in self._root.glob("*.json"):
            try:
                user = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            if user.get("user_id") == user_id:
                idx.write_text(user["username"].lower(), encoding="utf-8")
                return user
        return None

    def delete(self, user_id: str) -> bool:
        with self._lock:
            user = self.get_by_id(user_id)
            if not user:
                return False
            self._path(user["username"]).unlink(missing_ok=True)
            (self._root / f"{user_id}.idx").unlink(missing_ok=True)
            return True

    # ---- federated identity -------------------------------------------------
    #
    # A Google account is linked by its opaque `sub` only. No email, name, or
    # picture is stored, so a Google-linked account is no more identifying to
    # TrueTrace than a password one.

    def _google_index(self, sub: str) -> Path:
        safe = "".join(c for c in sub if c.isalnum())
        return self._root / f"google-{safe}.gidx"

    def get_by_google_sub(self, sub: str) -> dict | None:
        idx = self._google_index(sub)
        if not idx.exists():
            return None
        return self.get_by_username(idx.read_text(encoding="utf-8").strip())

    def create_google_user(self, sub: str) -> dict:
        """Create an account linked to a Google subject id.

        The username is derived from the subject id, not from anything Google
        told us about the person, so it carries no personal information.
        """
        with self._lock:
            existing = self.get_by_google_sub(sub)
            if existing:
                return existing

            base = f"google-{uuid.uuid4().hex[:8]}"
            user = {
                "user_id": f"u-{uuid.uuid4().hex[:12]}",
                "username": base,
                # No password hash: this account cannot be used with the
                # username/password endpoint, and verify_password rejects it.
                "password_hash": "",
                "auth_provider": "google",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self._path(base).write_text(json.dumps(user, indent=2), encoding="utf-8")
            (self._root / f"{user['user_id']}.idx").write_text(base, encoding="utf-8")
            self._google_index(sub).write_text(base, encoding="utf-8")
            return user
