"""Identity-matching configuration.

Split into its own service from services/detector for one reason: memory.
The deepfake classifier (torch + transformers + mediapipe) and the original
identity-matching stack (torch + torchvision + facenet-pytorch's MTCNN)
together measured 568MB resident - over the 512MB free tier on the host this
project actually deploys to. Rewritten on onnxruntime + insightface instead
of torch entirely: measured 361MB peak during a real 16-frame request, a
number low enough that running it as its own service, separate from the
classifier, was what actually made both fit for free. See identity.py for
the accuracy re-validation that came with the model swap.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # insightface's smallest packaged model set: SCRFD for detection, a
    # compact ArcFace-style recognition head. Measured 275MB idle / 361MB
    # under load, against 488MB idle / 550-588MB under load for the
    # facenet-pytorch stack this replaced - see docs in identity.py.
    model_pack: str = "buffalo_s"
    detection_size: int = 320

    # Deliberately lenient, same philosophy as the threshold this replaces:
    # a false ACCEPT costs little (the report still rests on the user's own
    # stated assertion, never on this score), while a false REJECT turns
    # away a real victim on an ordinary bad photo. Measured genuine-match
    # floor was 0.664 on the same validation crops used throughout this
    # project; industry-typical ArcFace cosine thresholds sit around
    # 0.28-0.40. This sits below the measured floor with real margin, above
    # the typical impostor range.
    match_threshold: float = 0.35


settings = Settings()
