"""End-to-end spine: a URL in, a risk band out.

Mirrors the demo path exactly, so if this script is healthy the demo is healthy.
Run:  python -m truetrace.scripts.e2e --url "<video url>"
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

from truetrace.adapters.fetcher import FallbackFetcher
from truetrace.core.detector_client import DetectorClient
from truetrace.core.frames import sample_frames
from truetrace.core.crypto import EvidenceKeyError, generate_key, load_key
from truetrace.core.evidence import build_manifest, build_package, chain_entry
from truetrace.core.hashing import sha256_file
from truetrace.core.verify import verify

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("e2e")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--frames", type=int, default=int(os.getenv("FRAME_SAMPLE_COUNT", "16")))
    parser.add_argument(
        "--detector", default=os.getenv("DETECTOR_URL", "http://127.0.0.1:8081")
    )
    parser.add_argument("--keep", action="store_true", help="keep the fetched video")
    parser.add_argument("--ttl-days", type=int, default=int(os.getenv("EVIDENCE_TTL_DAYS", "7")))
    args = parser.parse_args()

    started = time.monotonic()
    client = DetectorClient(args.detector)

    log.info("[0/5] detector health")
    try:
        log.info("      %s", client.health())
    except Exception as exc:
        log.error("      detector unreachable at %s: %s", args.detector, exc)
        return 2

    workdir = Path(tempfile.mkdtemp(prefix="truetrace_"))
    try:
        log.info("[1/5] fetching %s", args.url)
        result = FallbackFetcher().fetch(args.url, workdir)
        if not result.ok:
            log.error("      fetch failed: %s", result.degraded)
            return 3
        if result.degraded:
            log.warning("      DEGRADED: %s", result.degraded)
        log.info("      %s (%s)", result.metadata.get("title"), result.metadata.get("extractor"))

        digest = sha256_file(result.video_path)
        log.info("[2/5] sha256 %s", digest)

        frames = sample_frames(result.video_path, count=args.frames)
        log.info("[3/5] sampled %d frames", len(frames))
        if not frames:
            log.error("      no frames could be decoded")
            return 4

        log.info("[4/5] scoring")
        scored = client.score(frames)


        log.info("[5/5] sealing evidence package")
        try:
            key = load_key()
        except EvidenceKeyError:
            # A demo must not silently skip the evidence step, but it also must
            # not refuse to run before the operator has provisioned a key.
            key = load_key(generate_key())
            log.warning("      EVIDENCE_KEY unset - sealed with an EPHEMERAL key. "
                        "The package is real but unreadable after this run.")

        case_id = f"case-{digest[:12]}"
        named = [(f"frame_{f.index:03d}.jpg", f.jpeg) for f in frames]
        manifest = build_manifest(
            case_id=case_id,
            source_url=result.source_url,
            fetched_at=result.fetched_at,
            video_sha256=digest,
            source_metadata=result.metadata,
            analysis=scored,
            frames=named,
            degraded=result.degraded,
        )
        pkg = build_package(
            case_id=case_id,
            manifest=manifest,
            analysis=scored,
            frames=named,
            chain=[
                chain_entry("fetched", result.source_url),
                chain_entry("hashed", digest),
                chain_entry("sampled", f"{len(frames)} frames"),
                chain_entry("scored", f"{scored['band']} / {scored['score']}"),
                chain_entry("sealed", case_id),
            ],
            ttl_days=args.ttl_days,
            key=key,
        )

        out_dir = Path("out"); out_dir.mkdir(exist_ok=True)
        ttz = out_dir / f"{case_id}.ttz"
        ttz.write_bytes(pkg.blob)
        ttz.with_suffix(".sha256").write_text(pkg.manifest_sha256, encoding="utf-8")

        ok, lines = verify(pkg.blob, pkg.manifest_sha256, key)

        print()
        print("=" * 62)
        print(f"  BAND        {scored['band'].upper()}")
        print(f"  SCORE       {scored['score']}")
        print(f"  FRAMES      {scored['frames_scored']} scored / "
              f"{scored['frames_with_face']} with face / {scored['frames_submitted']} sampled")
        print(f"  DISPERSION  {scored['dispersion']}")
        print(f"  MODEL       {scored['model_version']}")
        print("  LIMITATIONS")
        for item in scored["limitations"]:
            print(f"    - {item}")
        print("-" * 62)
        print(f"  EVIDENCE    {ttz}  ({len(pkg.blob) / 1024:.0f} KB, encrypted)")
        print(f"  MANIFEST    {pkg.manifest_sha256}")
        print(f"  EXPIRES     {pkg.expires_at.isoformat()}")
        print(f"  VERIFY      {'VERIFIED' if ok else 'FAILED'}")
        print("=" * 62)
        print(f"  total {time.monotonic() - started:.1f}s")
        return 0 if ok else 5
    finally:
        if args.keep:
            log.info("kept working dir: %s", workdir)
        else:
            # The raw video is the most sensitive artifact here; it is never
            # persisted and never uploaded anywhere.
            shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
