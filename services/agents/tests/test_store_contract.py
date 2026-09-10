"""One contract, two backends.

`JsonCaseStore` and `FirestoreCaseStore` are interchangeable only if they behave
the same. These tests run against the local store — the one that can be executed
without credentials — and simultaneously serve as the written specification the
Firestore implementation has to meet.

The Firestore class itself is checked structurally, so a signature drift is
caught here rather than in production on a day when someone flips
CASE_BACKEND=firestore for the first time.
"""
import inspect
import os

import pytest

from truetrace.adapters import build_case_store
from truetrace.adapters.store import CaseStore, JsonCaseStore


@pytest.fixture
def store(tmp_path):
    return JsonCaseStore(tmp_path)


def make_case(case_id="case-abc123", owner="u-owner1"):
    return {
        "case_id": case_id,
        "owner": owner,
        "status": "queued",
        "source_url": "https://example.test/v",
        "created_at": "2026-09-10T10:00:00+00:00",
        "analysis": None,
        "evidence": None,
        "preview_b64": None,
        "error": None,
    }


# ------------------------------------------------------------ behaviour

def test_create_then_get_roundtrips(store):
    store.create(make_case())
    got = store.get("case-abc123")
    assert got is not None
    assert got["source_url"] == "https://example.test/v"


def test_get_unknown_case_returns_none(store):
    assert store.get("case-does-not-exist") is None


def test_update_merges_rather_than_replaces(store):
    store.create(make_case())
    store.update("case-abc123", {"status": "complete"})
    got = store.get("case-abc123")
    assert got["status"] == "complete"
    assert got["source_url"] == "https://example.test/v"  # untouched field survives


def test_create_seeds_an_empty_audit_trail(store):
    store.create(make_case())
    assert store.get("case-abc123")["audit"] == []


def test_audit_entries_append_in_order(store):
    store.create(make_case())
    for action in ("created", "fetched", "sealed"):
        store.append_audit("case-abc123", action, f"detail-{action}")
    audit = store.get("case-abc123")["audit"]
    assert [a["action"] for a in audit] == ["created", "fetched", "sealed"]
    assert all(a["at"] for a in audit)


def test_audit_on_missing_case_is_a_no_op(store):
    # A pipeline racing a deleted case must not crash.
    store.append_audit("case-gone", "sealed")


def test_listing_is_scoped_to_one_owner(store):
    store.create(make_case("case-1", owner="u-alice"))
    store.create(make_case("case-2", owner="u-alice"))
    store.create(make_case("case-3", owner="u-mallory"))
    assert len(store.list_for_owner("u-alice")) == 2
    assert len(store.list_for_owner("u-mallory")) == 1
    assert store.list_for_owner("u-nobody") == []


def test_case_ids_cannot_escape_the_store_root(store, tmp_path):
    # A traversal attempt must not write outside the configured directory.
    store.create(make_case("../../etc/case-evil"))
    assert not (tmp_path.parent.parent / "etc").exists()


# ------------------------------------------------- backend selection

def test_default_backend_is_local_json(monkeypatch):
    monkeypatch.delenv("CASE_BACKEND", raising=False)
    assert isinstance(build_case_store(), JsonCaseStore)


def test_unavailable_firestore_falls_back_instead_of_crashing(monkeypatch):
    # No credentials here, so the Firestore client cannot be built. The service
    # must still start — degraded, and loudly, but running.
    monkeypatch.setenv("CASE_BACKEND", "firestore")
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "definitely-not-a-real-project")
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "/nonexistent/key.json")
    assert isinstance(build_case_store(), JsonCaseStore)


def test_unknown_backend_name_falls_back(monkeypatch):
    monkeypatch.setenv("CASE_BACKEND", "postgres")
    assert isinstance(build_case_store(), JsonCaseStore)


# ------------------------------------------- firestore conforms structurally

def test_firestore_store_implements_every_protocol_method():
    """Catches signature drift without needing Firestore credentials."""
    from truetrace.adapters.firestore_store import FirestoreCaseStore

    required = [m for m in dir(CaseStore) if not m.startswith("_")]
    assert required, "protocol exposes no methods - the check would be vacuous"

    for name in required:
        assert hasattr(FirestoreCaseStore, name), f"FirestoreCaseStore is missing {name}"
        proto_params = list(inspect.signature(getattr(CaseStore, name)).parameters)
        impl_params = list(inspect.signature(getattr(FirestoreCaseStore, name)).parameters)
        assert proto_params == impl_params, (
            f"{name} signature drifted: protocol {proto_params}, "
            f"implementation {impl_params}"
        )


def test_firestore_drops_oversized_previews_rather_than_failing():
    """Firestore rejects documents over 1 MiB. Losing a thumbnail is
    recoverable; losing the case record is not."""
    from truetrace.adapters.firestore_store import FirestoreCaseStore

    huge = {**make_case(), "preview_b64": "A" * 500_000}
    trimmed = FirestoreCaseStore._trim(huge)
    assert trimmed["preview_b64"] is None
    assert trimmed["preview_dropped"] is True

    small = {**make_case(), "preview_b64": "A" * 1000}
    assert FirestoreCaseStore._trim(small)["preview_b64"] == "A" * 1000


# ------------------------------------------------- user store resilience

def test_user_is_still_resolvable_after_the_index_is_lost(tmp_path):
    """Regression: a missing id index used to give 'login works, then every
    request 401s' — the account file was intact but only the id lookup broke."""
    from truetrace.adapters.store import JsonUserStore

    users = JsonUserStore(tmp_path)
    created = users.create("someone", "scrypt$1$1$1$aa$bb")
    uid = created["user_id"]

    for idx in tmp_path.glob("*.idx"):
        idx.unlink()

    found = users.get_by_id(uid)
    assert found is not None, "account became unreachable when its index vanished"
    assert found["username"] == "someone"
    assert (tmp_path / f"{uid}.idx").exists(), "index was not rebuilt"


def test_index_pointing_at_a_deleted_account_is_cleaned_up(tmp_path):
    from truetrace.adapters.store import JsonUserStore

    users = JsonUserStore(tmp_path)
    created = users.create("ghost", "scrypt$1$1$1$aa$bb")
    uid = created["user_id"]

    (tmp_path / "ghost.json").unlink()  # account removed, index left behind

    assert users.get_by_id(uid) is None
    assert not (tmp_path / f"{uid}.idx").exists(), "stale index was not removed"


def test_corrupt_account_file_does_not_break_the_scan(tmp_path):
    from truetrace.adapters.store import JsonUserStore

    users = JsonUserStore(tmp_path)
    good = users.create("intact", "scrypt$1$1$1$aa$bb")
    (tmp_path / "broken.json").write_text("{ not json", encoding="utf-8")
    for idx in tmp_path.glob("*.idx"):
        idx.unlink()

    assert users.get_by_id(good["user_id"])["username"] == "intact"
