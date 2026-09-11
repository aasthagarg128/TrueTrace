# Heaviest of the three services: torch, mediapipe, and the two model
# checkpoints (deepfake classifier + face embedder) it loads at startup.
# CPU-only torch/torchvision, matching the pins in requirements.txt and the
# README's local setup instructions.
FROM python:3.11-slim

# libgl1 and libglib2.0-0: mediapipe and opencv-python-headless both link
# against them at import time even though neither ever opens a display.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# facenet-pytorch declares torch<2.3.0, stricter than what it actually needs -
# verified locally (services/detector/tests + live /identity/verify calls)
# that its two exports actually used here (MTCNN, InceptionResnetV1) run
# correctly against 2.5.1. --no-deps skips that overly conservative pin
# rather than downgrading torch for the whole service to satisfy it.
RUN pip install --no-cache-dir \
    torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir --no-deps facenet-pytorch==2.6.0 \
    && grep -vE '^(torch|torchvision|facenet-pytorch)==' requirements.txt > /tmp/rest.txt \
    && pip install --no-cache-dir -r /tmp/rest.txt

COPY app ./app

ENV PYTHONUNBUFFERED=1
# Cloud Run sets PORT; uvicorn must bind to it, not a hardcoded value.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8081}
