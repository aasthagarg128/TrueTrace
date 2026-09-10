"""Evidence retention.

Two failure modes, and the second is much worse than the first:

  1. An expired package survives — the privacy page lies, which is the bug this
     code exists to fix.
  2. A live package is deleted — someone loses evidence they were relying on.

Most of these tests are about the second one.
"""
from datetime import datetime, timedelta, timezone

import pytest

from truetrace.adapters.store import JsonCaseStore
from truetrace.core.retention import ORPHAN_GRACE_SECONDS, sweep

NOW = datetime(2026, 9, 11, 12, 0, tzinfo=timezone.utc)


@pytest.fixture
def env(tmp_path):
    cases = tmp_path / "cases"
    evidence = tmp_path / "evidence"
    evidence.mkdir()
    return JsonCaseStore(cases), evidence


def seal(store, evidence_dir, case_id, expires_at, *, age_seconds=ORPHAN_GRACE_SECONDS + 60):
    """Create a case with a package on disk, aged past the orphan grace period
    by default so the grace window is not silently doing the work."""
    import os

    ttz = evidence_dir / f"{case_id}.ttz"
    ttz.write_bytes(b"sealed-archive-bytes")
    (evidence_dir / f"{case_id}.sha256").write_text("a" * 64, encoding="utf-8")
    old = NOW.timestamp() - age_seconds
    os.utime(ttz, (old, old))

    store.create({
        "case_id": case_id,
        "owner": "u-owner",
        "status": "complete",
        "source_url": "https://example.test/v",
        "created_at": NOW.isoformat(),
        "evidence": {
            "path": str(ttz),
            "size_bytes": 20,
            "manifest_sha256": "m" * 64,
            "video_sha256": "v" * 64,
            "fetched_at": NOW.isoformat(),
            "sealed_at": NOW.isoformat(),
            "expires_at": expires_at.isoformat(),
            "frame_count": 16,
        },
    })
    return ttz


# ------------------------------------------------ the bug this fixes

def test_expired_package_is_deleted(env):
    store, ev = env
    ttz = seal(store, ev, "case-old", NOW - timedelta(days=1))

    result = sweep(store, ev, now=NOW)

    assert not ttz.exists(), "expired package survived the sweep"
    assert not ttz.with_suffix(".sha256").exists(), "hash sidecar survived"
    assert result.expired == 1


def test_expiring_leaves_a_tombstone_not_a_hole(env):
    store, ev = env
    seal(store, ev, "case-old", NOW - timedelta(days=1))
    sweep(store, ev, now=NOW)

    evidence = store.get("case-old")["evidence"]
    assert evidence["expired"] is True
    assert "path" not in evidence, "a path to a deleted file would mislead the UI"
    # Hashes are fingerprints, not content: keeping them preserves the claim
    # that a given file existed at a given time.
    assert evidence["video_sha256"] == "v" * 64
    assert evidence["manifest_sha256"] == "m" * 64
    assert evidence["frame_count"] == 16


def test_expiry_is_recorded_on_the_timeline(env):
    store, ev = env
    seal(store, ev, "case-old", NOW - timedelta(days=1))
    sweep(store, ev, now=NOW)
    actions = [a["action"] for a in store.get("case-old")["audit"]]
    assert "evidence_expired" in actions


# ------------------------------------------ never delete live evidence

def test_unexpired_package_is_untouched(env):
    store, ev = env
    ttz = seal(store, ev, "case-live", NOW + timedelta(days=3))

    result = sweep(store, ev, now=NOW)

    assert ttz.exists(), "a package still within its TTL was deleted"
    assert result.expired == 0
    assert store.get("case-live")["evidence"].get("expired") is None


def test_package_expiring_one_second_from_now_survives(env):
    store, ev = env
    ttz = seal(store, ev, "case-edge", NOW + timedelta(seconds=1))
    sweep(store, ev, now=NOW)
    assert ttz.exists()


def test_unreadable_expiry_is_left_alone(env):
    """Deleting evidence because a date could not be parsed would be a far worse
    bug than keeping it. Fail safe, and report it."""
    store, ev = env
    ttz = seal(store, ev, "case-bad", NOW - timedelta(days=1))
    store.update("case-bad", {
        "evidence": {**store.get("case-bad")["evidence"], "expires_at": "not-a-date"}
    })

    result = sweep(store, ev, now=NOW)

    assert ttz.exists(), "evidence deleted on the strength of an unparseable date"
    assert any("unreadable expires_at" in e for e in result.errors)


def test_case_still_processing_is_ignored(env):
    store, ev = env
    store.create({
        "case_id": "case-running", "owner": "u-owner", "status": "screening",
        "source_url": "https://example.test/v", "created_at": NOW.isoformat(),
        "evidence": None,
    })
    result = sweep(store, ev, now=NOW)
    assert result.expired == 0
    assert result.errors == []


def test_a_just_written_orphan_is_not_deleted(env):
    """The race that motivated the grace period: a package is written a moment
    before the case record points at it. A sweep landing in that window must not
    treat it as abandoned."""
    import os

    store, ev = env
    fresh = ev / "case-inflight.ttz"
    fresh.write_bytes(b"just-sealed")
    # mtime must be set relative to the injected NOW, not left at the real
    # wall clock — otherwise the file only looks fresh if the test happens to
    # run at the right hour.
    just_now = NOW.timestamp() - 5
    os.utime(fresh, (just_now, just_now))

    result = sweep(store, ev, now=NOW)

    assert fresh.exists(), "deleted a package that was seconds old"
    assert result.orphans_deleted == 0


# ------------------------------------------------------- housekeeping

def test_old_orphan_is_cleaned_up(env):
    import os
    store, ev = env
    stray = ev / "case-abandoned.ttz"
    stray.write_bytes(b"left-behind")
    old = NOW.timestamp() - ORPHAN_GRACE_SECONDS - 60
    os.utime(stray, (old, old))

    result = sweep(store, ev, now=NOW)

    assert not stray.exists()
    assert result.orphans_deleted >= 1


def test_sweeping_twice_changes_nothing_the_second_time(env):
    store, ev = env
    seal(store, ev, "case-old", NOW - timedelta(days=1))

    first = sweep(store, ev, now=NOW)
    second = sweep(store, ev, now=NOW)

    assert first.expired == 1
    assert second.expired == 0, "a tombstoned case was swept again"
    assert second.errors == []


def test_one_bad_case_does_not_stop_the_others(env):
    store, ev = env
    seal(store, ev, "case-a", NOW - timedelta(days=1))
    seal(store, ev, "case-b", NOW - timedelta(days=1))
    (store._root / "corrupt.json").write_text("{ not json", encoding="utf-8")

    result = sweep(store, ev, now=NOW)

    assert result.expired == 2, "a corrupt file interrupted the sweep"


def test_mixed_estate_is_handled_correctly(env):
    store, ev = env
    old_a = seal(store, ev, "case-old-a", NOW - timedelta(days=2))
    old_b = seal(store, ev, "case-old-b", NOW - timedelta(hours=1))
    live = seal(store, ev, "case-live", NOW + timedelta(days=5))

    result = sweep(store, ev, now=NOW)

    assert not old_a.exists() and not old_b.exists()
    assert live.exists()
    assert (result.scanned, result.expired) == (3, 2)
