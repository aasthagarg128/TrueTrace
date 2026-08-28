"""Case storage behind a narrow interface.

`JsonCaseStore` writes to local disk so the whole product runs with no cloud
account and no cost. `FirestoreCaseStore` implements the same Protocol and is
the only thing that needs to change to move to Google Cloud - no caller does.
"""
from __future__ import annotations

import json
import threading
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
