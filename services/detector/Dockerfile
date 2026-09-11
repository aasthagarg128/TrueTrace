# Deepfake classifier only now - identity matching moved to services/identity
# once the two combined exceeded the free-tier memory limit. See
# services/identity/app/identity.py for the measurements.
FROM python:3.11-slim

# libgl1 and libglib2.0-0: mediapipe and opencv-python-headless both link
# against them at import time even though neither ever opens a display.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir \
    torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV PYTHONUNBUFFERED=1
# torch/OpenMP size their thread pool to the host's VISIBLE cpu count, which
# on a shared cloud container is often far more than what's actually
# allocated to this instance - each thread gets its own workspace buffers,
# multiplying memory for no speed benefit on a free-tier single-core plan.
# Capped after an OOM on a real deploy that never showed up in local testing
# on a machine with different core-visibility behaviour.
ENV OMP_NUM_THREADS=1 MKL_NUM_THREADS=1
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8081}
