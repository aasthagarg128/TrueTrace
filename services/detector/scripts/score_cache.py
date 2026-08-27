"""Score cached crops with a given checkpoint, in calibrate.py's input format.

Lets a candidate model be threshold-analysed in seconds instead of re-running
video decode and face detection.
"""
from __future__ import annotations

import argparse, json, sys
from pathlib import Path

import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForImageClassification

FAKE_WORDS = ("fake", "deepfake", "manipulat", "artificial", "synthetic")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    cache = Path(args.cache)
    index = json.loads((cache / "index.json").read_text(encoding="utf-8"))

    proc = AutoImageProcessor.from_pretrained(args.model)
    m = AutoModelForImageClassification.from_pretrained(args.model); m.eval()
    fake_ix = next(i for i, l in m.config.id2label.items()
                   if any(w in l.lower() for w in FAKE_WORDS))
    print(f"labels={m.config.id2label} fake_ix={fake_ix}", flush=True)

    records = []
    for r in index:
        imgs = [Image.open(p).convert("RGB") for p in sorted((cache / r["dir"]).glob("*.png"))]
        vals = []
        for i in range(0, len(imgs), 16):
            with torch.no_grad():
                logits = m(**proc(images=imgs[i:i+16], return_tensors="pt")).logits
            vals += [round(float(p[fake_ix]), 6) for p in torch.softmax(logits, -1)]
        records.append({"video": r["video"], "label": r["label"],
                        "frames_sampled": r["frames_sampled"],
                        "frames_with_face": len(vals),
                        "face_confidences": [], "frame_scores": vals})
    Path(args.out).write_text(json.dumps(
        {"model_version": args.model, "frames_requested": 16, "elapsed_s": 0,
         "records": records}, indent=2), encoding="utf-8")
    print(f"wrote {args.out} ({len(records)} records)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
