"""Detector configuration. Everything tunable lives here, not scattered in code."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Pinned revision: an unpinned model id means the scores in an evidence
    # package can silently stop being reproducible.
    model_id: str = "prithivMLmods/Deep-Fake-Detector-v2-Model"
    model_revision: str = "3a99ae26f52c7ac7c3a53103b6cf3a8b617f7093"

    # A frame needs a face this confident before we score it at all.
    face_min_confidence: float = 0.5
    # Below this many usable frames the result is Inconclusive, never a score.
    min_scored_frames: int = 4
    # Top-k mean is the headline aggregate; k adapts to frame count.
    topk_ratio: float = 0.5
    # Per-frame probability above which a frame counts as "flagged".
    frame_flag_threshold: float = 0.6

    # Band cut points on the aggregate score.
    band_low_max: float = 0.35
    band_moderate_max: float = 0.65


settings = Settings()
