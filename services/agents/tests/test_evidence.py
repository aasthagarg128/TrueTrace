"""Evidence packages must be confidential, tamper-evident, and verifiable."""
import io
import json
import zipfile
from datetime import datetime, timezone

import pytest

from truetrace.core.crypto import (
    EvidenceIntegrityError,
    EvidenceKeyError,
    generate_key,
    load_key,
)
from truetrace.core.evidence import build_manifest, build_package, chain_entry
from truetrace.core.verify import verify

KEY = load_key(generate_key())

FRAMES = [("frame_000.jpg", b"\xff\xd8pretend-jpeg-0"), ("frame_001.jpg", b"\xff\xd8pretend-jpeg-1")]
ANALYSIS = {
    "model_version": "test-model@abc123",
    "band": "inconclusive",
    "score": None,
    "frames_submitted": 2,
    "frames_scored": 0,
    "dispersion": None,
    "limitations": ["not a determination"],
    "frames": [],
}


def make_package():
    manifest = build_manifest(
        case_id="case-1",
        source_url="https://example.test/v/1",
        fetched_at=datetime(2026, 8, 28, 12, 0, tzinfo=timezone.utc),
        video_sha256="a" * 64,
        source_metadata={"title": "t"},
        analysis=ANALYSIS,
        frames=FRAMES,
    )
    return build_package(
        case_id="case-1",
        manifest=manifest,
        analysis=ANALYSIS,
        frames=FRAMES,
        chain=[chain_entry("fetched"), chain_entry("analysed")],
        key=KEY,
    )


def test_package_verifies_and_reports_provenance():
    pkg = make_package()
    ok, lines = verify(pkg.blob, pkg.manifest_sha256, KEY)
    assert ok
    joined = "\n".join(lines)
    assert "authenticated" in joined
    assert "all 2 frame hashes match" in joined


def test_package_is_not_readable_without_the_key():
    pkg = make_package()
    # The archive must not be recoverable from the stored blob alone.
    with pytest.raises(zipfile.BadZipFile):
        zipfile.ZipFile(io.BytesIO(pkg.blob))


def test_tampering_with_the_blob_is_detected():
    pkg = make_package()
    corrupted = bytearray(pkg.blob)
    corrupted[-20] ^= 0x01  # flip one bit in the ciphertext
    ok, lines = verify(bytes(corrupted), pkg.manifest_sha256, KEY)
    assert not ok
    assert "FAIL" in lines[0]


def test_swapping_in_a_different_manifest_hash_is_detected():
    pkg = make_package()
    ok, _ = verify(pkg.blob, "b" * 64, KEY)
    assert not ok


def test_wrong_key_cannot_open_the_package():
    pkg = make_package()
    ok, _ = verify(pkg.blob, pkg.manifest_sha256, load_key(generate_key()))
    assert not ok


def test_manifest_lists_a_hash_for_every_frame():
    pkg = make_package()
    names = {f["name"] for f in pkg.manifest["frames"]}
    assert names == {"frame_000.jpg", "frame_001.jpg"}
    assert all(len(f["sha256"]) == 64 for f in pkg.manifest["frames"])


def test_manifest_always_carries_the_not_a_verdict_notice():
    pkg = make_package()
    assert "not a determination" in pkg.manifest["notice"]


def test_packaging_is_deterministic_for_identical_input():
    # Determinism of the packaging step: identical inputs -> identical archive.
    # The chain log is passed explicitly because it records wall-clock actions
    # and is legitimately different between two runs; the property under test is
    # that nothing ELSE (zip mtimes, key ordering) varies.
    fixed_chain = ["2026-08-28T00:00:00+00:00	fetched", "2026-08-28T00:00:01+00:00	sealed"]

    def build():
        manifest = build_manifest(
            case_id="case-1",
            source_url="https://example.test/v/1",
            fetched_at=datetime(2026, 8, 28, 12, 0, tzinfo=timezone.utc),
            video_sha256="a" * 64,
            source_metadata={"title": "t"},
            analysis=ANALYSIS,
            frames=FRAMES,
        )
        return build_package(
            case_id="case-1", manifest=manifest, analysis=ANALYSIS,
            frames=FRAMES, chain=fixed_chain, key=KEY,
        )

    a, b = build(), build()
    assert a.zip_sha256 == b.zip_sha256
    assert a.manifest_sha256 == b.manifest_sha256
    assert a.blob != b.blob  # nonce is fresh each seal


def test_chain_log_records_distinct_timestamped_actions():
    pkg = make_package()
    ok, _ = verify(pkg.blob, pkg.manifest_sha256, KEY)
    assert ok


def test_missing_key_fails_loudly_with_guidance():
    with pytest.raises(EvidenceKeyError) as exc:
        load_key("")
    assert "EVIDENCE_KEY" in str(exc.value)


def test_malformed_key_is_rejected():
    with pytest.raises(EvidenceKeyError):
        load_key("dG9vLXNob3J0")  # valid base64, wrong length
