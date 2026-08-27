"""Detector configuration. Everything tunable lives here, not scattered in code.

The model choice and the threshold below are not defaults picked by intuition -
they are the outcome of a measured comparison of five checkpoints against 40 real
+ 40 fake real-world social media videos. See docs/detection-findings.md.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Chosen on evidence, not on model-card claims. Measured AUC on real-world
    # social video (max aggregation):
    #   deepfake-detector-model-v1   0.701   <- this one
    #   Deep-Fake-Detector-v2-Model  0.470   (below chance)
    #   Deepfake-Detect-Siglip2      0.484   (calls everything real)
    #   dima806/deepfake_vs_real     unusable (>=0.99 "fake" on authentic video)
    #   Wvolf/ViT_Deepfake_Detection 0.498   (calls everything fake)
    # Pinned by commit: an unpinned id means the scores recorded in an evidence
    # package can silently stop being reproducible.
    model_id: str = "prithivMLmods/deepfake-detector-model-v1"
    model_revision: str = "c5cb24c6a159dd2b57ca15c6a1065bd0ce8fa380"

    # A frame needs a face this confident before we score it at all.
    face_min_confidence: float = 0.5
    # Below this many usable frames the result is inconclusive, never a score.
    min_scored_frames: int = 4

    # Headline aggregation is the MAXIMUM per-frame score. Measured AUC by
    # aggregation: max 0.701, median 0.645, top50% 0.641, mean 0.632. Manipulation
    # is often confined to a few frames, so the extreme carries more signal than
    # any average.
    #
    # The flag threshold is deliberately high. Measured operating points:
    #   >=0.90  precision 0.77  recall 0.61  false-positive rate 0.17  <- chosen
    #   >=0.85  precision 0.65  recall 0.63  false-positive rate 0.33
    #   >=0.75  precision 0.56  recall 0.66  false-positive rate 0.50
    # Falsely telling someone their authentic video looks manipulated is a real
    # harm, so we accept missing more manipulations to keep false positives down.
    flag_threshold: float = 0.90

    # Measured error rates at flag_threshold, surfaced to users alongside every
    # result. Kept here so the number shown can never drift from the number
    # measured. Re-derive with scripts/calibrate.py if the model or corpus changes.
    measured_precision: float = 0.77
    measured_recall: float = 0.61
    measured_false_positive_rate: float = 0.17
    measured_auc: float = 0.701
    measured_corpus: str = "40 real + 38 fake social media videos (acroitoru/social_media_deepfakes test split)"


settings = Settings()
