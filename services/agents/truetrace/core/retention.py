"""Deleting evidence packages once their time-to-live has passed.

This exists because the product promised something it was not doing. Every
sealed package carries an `expires_at`, the Evidence tab displays it, and the
privacy page says records "are not kept indefinitely" — but nothing ever acted
on that date. The files lived forever.

For a product whose users are people whose intimate images were shared without
consent, a false privacy claim is worse than a missing feature. This closes it.

What is deleted and what is kept
--------------------------------
Deleted: the sealed `.ttz` archive and its hash sidecar. That archive contains
the sampled frames — the sensitive part, and the part promised to be temporary.

Kept: a tombstone on the case record holding the content hash, the manifest
hash, the frame count, and when it expired. Those are one-way fingerprints, not
content. Keeping them means the case timeline stays intact and the person can
still state that a file with a given SHA-256 existed at a given time, which is
most of the evidentiary value. Throwing them away too would destroy proof for
no privacy gain.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger(__name__)

# A package is written to disk a moment before the case record points at it.
# Without this grace period a sweep running during that window would see a
# file nothing references yet and delete evidence that was seconds old.
ORPHAN_GRACE_SECONDS = 60 * 60


@dataclass
class SweepResult:
    scanned: int = 0
    expired: int = 0
    files_deleted: int = 0
    orphans_deleted: int = 0
    errors: list[str] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"scanned {self.scanned}, expired {self.expired}, "
            f"files removed {self.files_deleted}, orphans {self.orphans_deleted}, "
            f"errors {len(self.errors)}"
        )


def _parse(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        parsed = datetime.fromisoformat(ts)
    except (TypeError, ValueError):
        return None
    # A naive timestamp would blow up the comparison below. Assume UTC, which is
    # what everything in this codebase writes.
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _remove(path: Path, result: SweepResult) -> int:
    removed = 0
    for target in (path, path.with_suffix(".sha256")):
        try:
            if target.exists():
                target.unlink()
                removed += 1
        except OSError as exc:
            result.errors.append(f"{target}: {exc}")
    return removed


def sweep(store, evidence_dir: str | Path, now: datetime | None = None) -> SweepResult:
    """Delete expired packages and clear their evidence block.

    Safe to run repeatedly and safe to run concurrently with the pipeline: a
    case still being processed has no evidence block yet, and one already swept
    is skipped because its block is a tombstone rather than a live record.
    """
    now = now or datetime.now(timezone.utc)
    root = Path(evidence_dir)
    result = SweepResult()
    live_files: set[Path] = set()

    for case in store.iter_cases():
        result.scanned += 1
        evidence = case.get("evidence") or {}

        # Already swept. The tombstone has no `path`, so there is nothing to do.
        if evidence.get("expired"):
            continue

        path = evidence.get("path")
        if not path:
            continue

        expires = _parse(evidence.get("expires_at"))
        if expires is None:
            # No usable expiry: leave it alone rather than guess. Deleting
            # someone's evidence on the strength of an unparseable date would be
            # a far worse bug than keeping it.
            result.errors.append(f"{case.get('case_id')}: unreadable expires_at")
            live_files.add(Path(path).resolve())
            continue

        if expires > now:
            live_files.add(Path(path).resolve())
            continue

        result.expired += 1
        result.files_deleted += _remove(Path(path), result)

        store.update(
            case["case_id"],
            {
                "evidence": {
                    "expired": True,
                    "expired_at": expires.isoformat(),
                    "swept_at": now.isoformat(),
                    # Hashes are fingerprints, not content. Keeping them
                    # preserves the evidentiary claim without keeping the frames.
                    "video_sha256": evidence.get("video_sha256"),
                    "manifest_sha256": evidence.get("manifest_sha256"),
                    "frame_count": evidence.get("frame_count"),
                    "fetched_at": evidence.get("fetched_at"),
                    "sealed_at": evidence.get("sealed_at"),
                }
            },
        )
        try:
            store.append_audit(case["case_id"], "evidence_expired", expires.isoformat())
        except Exception as exc:  # audit must never block the deletion
            result.errors.append(f"{case.get('case_id')} audit: {exc}")

    # Packages on disk that no case refers to any more — left behind by a
    # deleted case or an interrupted run. Nothing will ever reference them.
    #
    # Only files older than the grace period are candidates. A package is
    # written just before the case record points at it, and a sweep landing in
    # that window would otherwise delete brand-new evidence.
    if root.exists():
        cutoff = now.timestamp() - ORPHAN_GRACE_SECONDS
        for stray in root.glob("*.ttz"):
            if stray.resolve() in live_files:
                continue
            try:
                if stray.stat().st_mtime > cutoff:
                    continue  # too recent to be sure it is an orphan
            except OSError:
                continue
            result.orphans_deleted += _remove(stray, result)

    if result.expired or result.orphans_deleted or result.errors:
        log.info("retention sweep: %s", result.summary())
    return result
