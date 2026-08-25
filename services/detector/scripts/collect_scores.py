"""Run the detector over a labelled video corpus and dump RAW per-frame scores.

Collection is separated from analysis on purpose: inference over a corpus is
slow, and thresholds need to be re-derived many times. This writes the scores
once; calibrate.py reads them as often as needed.

Expects:  <corpus>/real/*.mp4  and  <corpus>/fake/*.mp4
Usage:    python -m scripts.collect_scores --corpus .scratch/calib --out .scratch/scores.json
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

import cv2

from app.classifier import get_classifier
from app.faces import FaceDetector

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("collect")

# Local sampler rather than importing the agents package: in production the
# detector never touches video, and calibration should not create that coupling.
def sample(video: Path, count: int) -> list:
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        return []
    try:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total <= 0:
            return []
        step = max(1, total // count)
        out = []
        for i in range(count):
            cap.set(cv2.CAP_PROP_POS_FRAMES, min(i * step, total - 1))
            ok, img = cap.read()
            if ok and img is not None:
                out.append(img)
        return out
    finally:
        cap.release()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--frames", type=int, default=16)
    args = ap.parse_args()

    corpus = Path(args.corpus)
    clf = get_classifier()
    clf.load()
    faces = FaceDetector()

    records = []
    started = time.monotonic()
    for label in ("real", "fake"):
        videos = sorted((corpus / label).glob("*.mp4"))
        for n, video in enumerate(videos, 1):
            frames = sample(video, args.frames)
            crops, confs = [], []
            for img in frames:
                face = faces.largest_face(img)
                if face is not None:
                    crops.append(face.image)
                    confs.append(round(face.confidence, 4))
            scores = [round(s, 6) for s in clf.score_batch(crops)] if crops else []
            records.append({
                "video": video.name,
                "label": label,
                "frames_sampled": len(frames),
                "frames_with_face": len(crops),
                "face_confidences": confs,
                "frame_scores": scores,
            })
            log.info("[%s %3d/%3d] %-24s faces=%2d/%2d mean=%s",
                     label, n, len(videos), video.name[:24], len(crops), len(frames),
                     f"{sum(scores)/len(scores):.3f}" if scores else "n/a")

    payload = {
        "model_version": clf.version,
        "frames_requested": args.frames,
        "elapsed_s": round(time.monotonic() - started, 1),
        "records": records,
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(payload, indent=2), encoding="utf-8")
    log.info("wrote %s (%d records, %.0fs)", args.out, len(records), payload["elapsed_s"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
