"""Derive band thresholds from measured scores - or show that we cannot.

Reads the raw dump from collect_scores.py and asks three questions:
  1. Does any aggregation of frame scores separate real from fake at all? (AUC)
  2. If so, where should the thresholds sit?
  3. What are the resulting error rates, stated plainly?

An AUC near 0.5 means the model is guessing, and no threshold can rescue it.
Saying so is the point of this script.
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path

import numpy as np


def agg_mean(s): return float(np.mean(s))
def agg_median(s): return float(np.median(s))
def agg_max(s): return float(np.max(s))
def agg_topk(s, ratio=0.5):
    v = sorted(s, reverse=True)
    k = max(1, int(len(v) * ratio))
    return float(np.mean(v[:k]))
def agg_frac_over(s, t=0.6): return float(np.mean([x >= t for x in s]))

AGGREGATIONS = {
    "mean": agg_mean,
    "median": agg_median,
    "max": agg_max,
    "top50%mean": agg_topk,
    "frac>=0.6": agg_frac_over,
}


def auc(pos: list[float], neg: list[float]) -> float:
    """Probability a random fake scores above a random real (Mann-Whitney U)."""
    if not pos or not neg:
        return float("nan")
    wins = ties = 0
    for p in pos:
        for n in neg:
            if p > n: wins += 1
            elif p == n: ties += 1
    return (wins + 0.5 * ties) / (len(pos) * len(neg))


def rates(pos, neg, threshold):
    tp = sum(1 for p in pos if p >= threshold)
    fn = len(pos) - tp
    fp = sum(1 for n in neg if n >= threshold)
    tn = len(neg) - fp
    return tp, fn, fp, tn


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scores", required=True)
    ap.add_argument("--min-frames", type=int, default=4)
    args = ap.parse_args()

    data = json.loads(Path(args.scores).read_text(encoding="utf-8"))
    records = data["records"]

    usable = [r for r in records if len(r["frame_scores"]) >= args.min_frames]
    dropped = len(records) - len(usable)

    print(f"model      {data['model_version']}")
    print(f"corpus     {len(records)} videos ({dropped} below the {args.min_frames}-frame "
          f"minimum -> would return INCONCLUSIVE)")
    print(f"usable     {len(usable)}  "
          f"real={sum(1 for r in usable if r['label']=='real')} "
          f"fake={sum(1 for r in usable if r['label']=='fake')}\n")

    print(f"{'aggregation':<14} {'AUC':>6}  {'real mean':>10} {'fake mean':>10}  {'separation':>10}")
    print("-" * 60)
    results = {}
    for name, fn in AGGREGATIONS.items():
        real = [fn(r["frame_scores"]) for r in usable if r["label"] == "real"]
        fake = [fn(r["frame_scores"]) for r in usable if r["label"] == "fake"]
        a = auc(fake, real)
        results[name] = (a, real, fake)
        print(f"{name:<14} {a:>6.3f}  {statistics.mean(real):>10.3f} "
              f"{statistics.mean(fake):>10.3f}  {statistics.mean(fake)-statistics.mean(real):>10.3f}")

    best = max(results, key=lambda k: results[k][0])
    a, real, fake = results[best]
    print(f"\nbest aggregation: {best}  (AUC {a:.3f})")
    print("AUC 0.5 = coin flip, 1.0 = perfect separation\n")

    if a < 0.65:
        print("!! AUC is too low to support a meaningful risk score.")
        print("   No threshold choice can fix a model that does not separate the classes.")
        print("   Presenting a number derived from this would be misleading.\n")

    print(f"{'threshold':>9} {'TP':>4} {'FN':>4} {'FP':>4} {'TN':>4}  "
          f"{'recall':>7} {'FP rate':>8} {'precision':>9}")
    print("-" * 62)
    for t in [x / 20 for x in range(2, 19)]:
        tp, fn, fp, tn = rates(fake, real, t)
        recall = tp / (tp + fn) if tp + fn else 0
        fpr = fp / (fp + tn) if fp + tn else 0
        prec = tp / (tp + fp) if tp + fp else 0
        print(f"{t:>9.2f} {tp:>4} {fn:>4} {fp:>4} {tn:>4}  {recall:>7.2f} {fpr:>8.2f} {prec:>9.2f}")

    print("\nreal  quartiles:", [round(float(np.percentile(real, p)), 3) for p in (0, 25, 50, 75, 100)])
    print("fake  quartiles:", [round(float(np.percentile(fake, p)), 3) for p in (0, 25, 50, 75, 100)])
    return 0


if __name__ == "__main__":
    sys.exit(main())
