# Detection layer: measured behaviour (2026-08-28)

Measured on day one rather than trusted from model cards, because the whole
"risk score, never a verdict" framing depends on knowing how wrong the model is.

## What was tested

| Input | Nature | Correct answer |
|---|---|---|
| Big Buck Bunny (720p, 10s) | Animated, no human faces | no score possible |
| Obama Boston statement, 2013 `.ogv`, ~640x360 | **Authentic**, heavily compressed | real |
| 2 Wikimedia portraits, 960px & 480px | **Authentic**, clean, high quality | real |

No manipulated samples yet — so these numbers measure **false positives only**.

## Results

**Animated video (no faces):** 0/16 frames yielded a face. Returned
`INCONCLUSIVE`, score `null`. Correct, and the honest-output path works.

**Authentic compressed video** — 16/16 frames had faces, median crop 262x262
(large enough; not an out-of-distribution size problem):

| Checkpoint | Per-frame P(fake) | Mean | Verdict |
|---|---|---|---|
| `prithivMLmods/Deep-Fake-Detector-v2-Model` | 0.155 – 0.784, scattered | 0.540 | **False positive: banded HIGH (0.704)** |
| `dima806/deepfake_vs_real_image_detection` | 15/16 frames ≥ 0.99 | 0.945 | **Confidently wrong** |

**Authentic clean portraits:**

| Checkpoint | P(fake) | Verdict |
|---|---|---|
| `prithivMLmods/...v2` | 0.317, 0.321 | both correct |
| `dima806/...` | 0.998, 0.298 | one confidently wrong |

## Conclusions

1. **The published 97–99% accuracy does not transfer.** On clean studio portraits
   the primary checkpoint is roughly right (~0.32). On ordinary compressed video
   of the same kind of subject it drifts to ~0.54 mean with huge frame-to-frame
   scatter — i.e. close to noise.

2. **Compression, not face size, is the driver.** Crops averaged 262x262, well
   above the 224x224 the model expects. The degradation tracks source quality.

3. **`dima806` is not usable.** It returns ≥0.99 "fake" on authentic footage.
   Higher headline accuracy on its own test split, far worse generalisation.
   Keep `prithivMLmods/...v2` as the default.

4. **The current band thresholds (0.35 / 0.65) are unvalidated guesses and are
   demonstrably wrong.** They banded an authentic government video as HIGH. They
   must be set from a measured distribution, not chosen by intuition.

## What this means for the product

A false "HIGH" on authentic video is a serious harm in this product's context:
it tells someone their real video is fake. The mirror error - reassuring someone
whose deepfake is real - is worse still.

This does not sink TrueTrace, but it does relocate its value. The defensible
contribution is the **evidence package and the platform-correct takedown report**;
detection is a triage hint, and must be presented as one.

## Required next steps

- [ ] Assemble a calibration corpus: ~30 authentic + ~30 manipulated clips
      (FaceForensics++ / Celeb-DF), matched for compression.
- [ ] Set band thresholds from the measured distribution; publish the real
      false-positive and false-negative rates in the README.
- [ ] Add an input-quality gate (resolution, blur, bitrate) that widens
      `INCONCLUSIVE` for low-quality sources instead of guessing.
- [ ] Consider frame-score agreement as a confidence signal in its own right:
      scatter of 0.155–0.784 across one person in one video is itself evidence
      the model has no real opinion.

---

# Calibration against a labelled corpus (2026-08-28, later same day)

The earlier section measured false positives on a handful of authentic clips.
This section attempts the actual calibration, and reaches a harder conclusion.

## Corpus

`acroitoru/social_media_deepfakes` (Hugging Face, ungated, free) — real-world
social media video, both authentic and manipulated. Chosen over FaceForensics++
and Celeb-DF because those are access-gated with multi-day approval, and because
this corpus matches TrueTrace's actual input distribution: compressed,
re-encoded, real-world footage rather than clean laboratory renders.

Balanced subset from the held-out **test** split: **40 real + 40 fake**, 16 frames
sampled per video, seed 11 for reproducibility. 78 of 80 videos yielded the
4-frame minimum; 2 correctly fell through to `INCONCLUSIVE`.

## Result: the checkpoint carries no signal

`prithivMLmods/Deep-Fake-Detector-v2-Model`, five aggregation strategies:

| Aggregation | AUC | real mean | fake mean | separation |
|---|---|---|---|---|
| mean | 0.461 | 0.394 | 0.370 | **-0.025** |
| median | 0.470 | 0.368 | 0.362 | **-0.005** |
| max | 0.360 | 0.706 | 0.634 | **-0.072** |
| top-50% mean | 0.445 | 0.537 | 0.496 | **-0.041** |
| fraction ≥ 0.6 | 0.448 | 0.304 | 0.263 | **-0.041** |

**Every aggregation scores at or below AUC 0.5.** 0.5 is a coin flip. The
separation column is *negative* throughout: manipulated videos score slightly
**lower** than authentic ones. The score distributions overlap almost exactly:

```
real quartiles:  0.101  0.159  0.288  0.552  0.768
fake quartiles:  0.073  0.122  0.376  0.559  0.751
```

Precision sits at 0.42–0.54 at every threshold from 0.10 to 0.75 — which is just
the corpus base rate (38/78 = 0.487). The model contributes nothing.

## Why no threshold can fix this

Calibration moves the operating point along a curve; it cannot create signal that
is not there. With AUC ≈ 0.47 there is no threshold, no aggregation, and no
confidence gate that produces a meaningful risk score. Shipping a number derived
from this would be presenting noise as evidence — to people deciding whether they
have been victimised.

## Consequences for the build

1. **Do not display a numeric risk score from this checkpoint.** Not with caveats,
   not greyed out, not "for reference".
2. The `INCONCLUSIVE` path is not an edge case; on this evidence it is the only
   honest output the current detector can produce.
3. TrueTrace's defensible value is the **evidence package** (built, sealed,
   independently verifiable) and the **platform-correct takedown report**.
   Detection is a research question, not a shippable feature, at this quality level.

## Reproducing

```bash
python -m scripts.cache_crops --corpus <corpus> --out .scratch/crops_cache
python -m scripts.collect_scores --corpus <corpus> --out .scratch/scores.json
python -m scripts.calibrate --scores .scratch/scores.json
```

---

# Checkpoint comparison and the chosen operating point (2026-08-28, final)

Before concluding that free pretrained detection is unusable, five checkpoints
were compared on the identical cached face crops from the same 78-video corpus.
Caching crops once made each additional model cost seconds rather than minutes.

| Checkpoint | AUC (median agg.) | separation | verdict |
|---|---|---|---|
| **`prithivMLmods/deepfake-detector-model-v1`** | **0.645** | **+0.157** | **best; selected** |
| `prithivMLmods/Deep-Fake-Detector-v2-Model` | 0.470 | −0.005 | below chance |
| `prithivMLmods/Deepfake-Detect-Siglip2` | 0.484 | +0.007 | calls everything real (both means ≈0.06) |
| `Wvolf/ViT_Deepfake_Detection` | 0.498 | −0.000 | calls everything fake (both means ≈0.91) |
| `dima806/deepfake_vs_real_image_detection` | — | — | ≥0.99 "fake" on authentic video |

The newer "v2" model is worse than the "v1" it replaced. Model-card version
numbers are not evidence.

## Aggregation matters as much as the model

For the selected checkpoint:

| Aggregation | AUC |
|---|---|
| **max** | **0.701** |
| median | 0.645 |
| top-50% mean | 0.641 |
| mean | 0.632 |
| fraction ≥0.6 | 0.624 |

Taking the **maximum** per-frame score beats every average. Manipulation is often
confined to a few frames, and averaging over clean frames washes the signal out.

## Chosen operating point: peak ≥ 0.90

| Threshold | precision | recall | false-positive rate |
|---|---|---|---|
| ≥0.75 | 0.56 | 0.66 | 0.50 |
| ≥0.85 | 0.65 | 0.63 | 0.33 |
| **≥0.90** | **0.77** | **0.61** | **0.17** |

Deliberately conservative. Falsely telling someone their authentic video looks
manipulated is a real harm, so we accept missing more manipulations (39%) to hold
false positives to 17%.

## What the product now outputs

Three states, never a graded risk number — AUC 0.701 is real signal but nowhere
near enough to support "risk 0.62":

- `INCONCLUSIVE` — too few usable frames; no conclusion in either direction.
- `FLAGGED` — peak ≥ 0.90, published together with "roughly 23% of flagged
  videos are in fact authentic".
- `NOT_FLAGGED` — published together with "this is NOT a finding that the video
  is authentic; the screening misses roughly 39% of manipulated videos".

The asymmetry is deliberate. A victim must never read a non-flag as reassurance.

## Honest caveat on the margin

Re-running the authentic 2013 government video that originally produced a false
HIGH now yields `NOT_FLAGGED` — but with a peak of **0.8998** against a 0.90
threshold. Correct by 0.0002. The threshold is doing real work, and the margin is
thin. Do not over-trust individual results near the boundary.

## Standing limitation

Validation used 78 videos from a single corpus. The error rates above are
indicative, not tight estimates; a corpus this size gives roughly ±10 percentage
points of sampling error. They are reported to users because an unquantified
signal is worse than a roughly quantified one, not because they are precise.
