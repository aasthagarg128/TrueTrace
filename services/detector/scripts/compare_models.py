"""Score cached crops with several checkpoints and report AUC for each.

The question is not which model has the best marketing number, but whether ANY
freely available checkpoint separates real from fake on real-world social video.
"""
from __future__ import annotations

import argparse, json, statistics, sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForImageClassification

FAKE_WORDS = ("fake", "deepfake", "manipulat", "artificial", "synthetic")


def auc(pos, neg):
    if not pos or not neg:
        return float("nan")
    wins = ties = 0
    for p in pos:
        for n in neg:
            if p > n: wins += 1
            elif p == n: ties += 1
    return (wins + 0.5 * ties) / (len(pos) * len(neg))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", required=True)
    ap.add_argument("--models", nargs="+", required=True)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    cache = Path(args.cache)
    index = json.loads((cache / "index.json").read_text(encoding="utf-8"))
    index = [r for r in index if r["crops"] >= 4]
    print(f"corpus: {len(index)} videos with >=4 crops "
          f"(real={sum(1 for r in index if r['label']=='real')}, "
          f"fake={sum(1 for r in index if r['label']=='fake')})\n")

    loaded = {}
    for r in index:
        loaded[r["dir"]] = [Image.open(p).convert("RGB")
                            for p in sorted((cache / r["dir"]).glob("*.png"))]

    print(f"{'model':<52} {'AUC':>6} {'real':>7} {'fake':>7} {'sep':>7}")
    print("-" * 84)
    summary = []
    for model_id in args.models:
        try:
            proc = AutoImageProcessor.from_pretrained(model_id)
            m = AutoModelForImageClassification.from_pretrained(model_id); m.eval()
            id2label = m.config.id2label
            fake_ix = next((i for i, l in id2label.items()
                            if any(w in l.lower() for w in FAKE_WORDS)), None)
            if fake_ix is None:
                print(f"{model_id[:52]:<52}  SKIP - cannot identify 'fake' label {id2label}")
                continue

            per_video = {}
            for r in index:
                imgs = loaded[r["dir"]]
                vals = []
                for i in range(0, len(imgs), 16):
                    with torch.no_grad():
                        logits = m(**proc(images=imgs[i:i+16], return_tensors="pt")).logits
                    vals += [float(p[fake_ix]) for p in torch.softmax(logits, -1)]
                per_video[r["video"]] = float(np.median(vals))

            real = [v for r in index if r["label"] == "real" for v in [per_video[r["video"]]]]
            fake = [v for r in index if r["label"] == "fake" for v in [per_video[r["video"]]]]
            a = auc(fake, real)
            summary.append({"model": model_id, "auc": round(a, 4),
                            "real_mean": round(statistics.mean(real), 4),
                            "fake_mean": round(statistics.mean(fake), 4)})
            print(f"{model_id[:52]:<52} {a:>6.3f} {statistics.mean(real):>7.3f} "
                  f"{statistics.mean(fake):>7.3f} {statistics.mean(fake)-statistics.mean(real):>7.3f}")
        except Exception as e:
            print(f"{model_id[:52]:<52}  FAILED: {str(e)[:60]}")

    print("\nAUC 0.5 = coin flip. Below ~0.65 there is no usable signal.")
    if args.out:
        Path(args.out).write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
