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
from truetrace.core.hashing import sha256_file

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
    args = parser.parse_args()

    started = time.monotonic()
    client = DetectorClient(args.detector)

    log.info("[0/4] detector health")
    try:
        log.info("      %s", client.health())
    except Exception as exc:
        log.error("      detector unreachable at %s: %s", args.detector, exc)
        return 2

    workdir = Path(tempfile.mkdtemp(prefix="truetrace_"))
    try:
        log.info("[1/4] fetching %s", args.url)
        result = FallbackFetcher().fetch(args.url, workdir)
        if not result.ok:
            log.error("      fetch failed: %s", result.degraded)
            return 3
        if result.degraded:
            log.warning("      DEGRADED: %s", result.degraded)
        log.info("      %s (%s)", result.metadata.get("title"), result.metadata.get("extractor"))

        digest = sha256_file(result.video_path)
        log.info("[2/4] sha256 %s", digest)

        frames = sample_frames(result.video_path, count=args.frames)
        log.info("[3/4] sampled %d frames", len(frames))
        if not frames:
            log.error("      no frames could be decoded")
            return 4

        log.info("[4/4] scoring")
        scored = client.score(frames)

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
        print("=" * 62)
        print(f"  total {time.monotonic() - started:.1f}s")

        Path("out").mkdir(exist_ok=True)
        report = {
            "source_url": result.source_url,
            "fetched_at": result.fetched_at.isoformat(),
            "video_sha256": digest,
            "metadata": result.metadata,
            "degraded": result.degraded,
            "analysis": scored,
        }
        out = Path("out") / f"e2e_{digest[:12]}.json"
        out.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"  written {out}")
        return 0
    finally:
        if args.keep:
            log.info("kept working dir: %s", workdir)
        else:
            # The raw video is the most sensitive artifact here; it is never
            # persisted and never uploaded anywhere.
            shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
