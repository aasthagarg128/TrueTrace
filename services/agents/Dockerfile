FROM python:3.11-slim

# opencv-python-headless (used for frame decoding, not display) still links
# against these on some minimal base images.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY truetrace ./truetrace

ENV PYTHONUNBUFFERED=1
CMD exec uvicorn truetrace.api:app --host 0.0.0.0 --port ${PORT:-8080}
