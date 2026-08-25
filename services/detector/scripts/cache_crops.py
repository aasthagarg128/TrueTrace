"""Extract face crops from the corpus ONCE so many checkpoints can be compared cheaply.

Video decode + face detection dominates runtime; classification is fast. Caching
crops turns "9 minutes per model" into "9 minutes, then seconds per model".
"""
from __future__ import annotations

import argparse, json, logging, sys, time
from pathlib import Path

import cv2

from app.faces import FaceDetector

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("cache")


def sample(video: Path, count: int):
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

    corpus, out = Path(args.corpus), Path(args.out)
    faces = FaceDetector()
    index, started = [], time.monotonic()

    for label in ("real", "fake"):
        for n, video in enumerate(sorted((corpus / label).glob("*.mp4")), 1):
            vdir = out / label / video.stem
            vdir.mkdir(parents=True, exist_ok=True)
            kept = 0
            for i, img in enumerate(sample(video, args.frames)):
                face = faces.largest_face(img)
                if face is None:
                    continue
                cv2.imwrite(str(vdir / f"{i:02d}.png"), face.image)
                kept += 1
            index.append({"video": video.name, "label": label,
                          "dir": str(vdir.relative_to(out)).replace("\\", "/"),
                          "crops": kept, "frames_sampled": args.frames})
            log.info("[%s %3d] %-22s crops=%2d", label, n, video.stem[:22], kept)

    (out / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
    log.info("cached %d videos in %.0fs -> %s", len(index), time.monotonic() - started, out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
