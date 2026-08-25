"""Independent verification of an evidence package.

This is what makes the package evidence rather than just an encrypted blob:
anyone with the key can re-check every hash and see, item by item, whether the
contents still match what the manifest claims.

Usage: python -m truetrace.core.verify --package out/case-x.ttz
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import zipfile
from pathlib import Path

from .crypto import EvidenceIntegrityError, load_key, unseal
from .evidence import MANIFEST_NAME
from .hashing import sha256_bytes


def verify(blob: bytes, manifest_sha256: str, key: bytes | None = None) -> tuple[bool, list[str]]:
    lines: list[str] = []
    try:
        raw_zip = unseal(blob, manifest_sha256, key)
    except EvidenceIntegrityError as exc:
        return False, [f"FAIL  decryption/authentication: {exc}"]
    lines.append("OK    package authenticated (AES-256-GCM tag valid)")

    with zipfile.ZipFile(io.BytesIO(raw_zip)) as zf:
        manifest_bytes = zf.read(MANIFEST_NAME)
        actual = sha256_bytes(manifest_bytes)
        if actual != manifest_sha256:
            return False, lines + [
                f"FAIL  manifest hash mismatch: expected {manifest_sha256}, got {actual}"
            ]
        lines.append(f"OK    manifest hash matches ({actual[:16]}...)")

        manifest = json.loads(manifest_bytes)
        ok = True
        for entry in manifest.get("frames", []):
            name = entry["name"]
            try:
                data = zf.read(f"frames/{name}")
            except KeyError:
                lines.append(f"FAIL  frame missing from package: {name}")
                ok = False
                continue
            digest = sha256_bytes(data)
            if digest != entry["sha256"]:
                lines.append(f"FAIL  frame altered: {name}")
                ok = False
        if ok:
            lines.append(f"OK    all {len(manifest.get('frames', []))} frame hashes match")

        src = manifest.get("source", {})
        lines.append(f"      source url      {src.get('url')}")
        lines.append(f"      fetched at      {src.get('fetched_at_utc')}")
        lines.append(f"      video sha256    {src.get('video_sha256')}")
        an = manifest.get("analysis", {})
        lines.append(f"      model           {an.get('model_version')}")
        lines.append(f"      band / score    {an.get('band')} / {an.get('score')}")
    return ok, lines


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--package", required=True, help="path to a .ttz file")
    ap.add_argument("--manifest-sha256", help="expected manifest hash (else read sidecar)")
    args = ap.parse_args()

    path = Path(args.package)
    blob = path.read_bytes()
    expected = args.manifest_sha256
    if not expected:
        sidecar = path.with_suffix(".sha256")
        if not sidecar.exists():
            print(f"need --manifest-sha256 or a sidecar at {sidecar}", file=sys.stderr)
            return 2
        expected = sidecar.read_text(encoding="utf-8").strip()

    ok, lines = verify(blob, expected, load_key())
    print(f"\nverifying {path.name}")
    print("-" * 60)
    for line in lines:
        print(line)
    print("-" * 60)
    print("RESULT:", "VERIFIED" if ok else "FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
