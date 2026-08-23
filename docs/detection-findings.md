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
