# TrueTrace

Privacy-first tooling for people whose likeness has been used in a manipulated
video: detect it, document it as evidence, and file the right takedown report.

> **Status: build in progress.** The intake -> detection -> scoring spine runs
> end to end. See [docs/detection-findings.md](docs/detection-findings.md) for
> measured detector accuracy before relying on any score.

## Layout

```
apps/web/            Next.js frontend (not yet scaffolded)
services/detector/   CPU inference service: face crop -> risk band
services/agents/     Intake / evidence / reporting agents
docs/                Findings and design notes
```

The two services have **separate virtualenvs and requirements**, because
MediaPipe pins protobuf <5 and the Google Cloud client libraries require >=5.
They deploy as separate Cloud Run services, so this is not a workaround.

## Setup

```bash
python -m venv .venv-detector && .venv-detector/Scripts/pip install -r services/detector/requirements.txt
```
```bash
python -m venv .venv-agents && .venv-agents/Scripts/pip install -r services/agents/requirements.txt
```

## Run

Start the detector (first run downloads ~330 MB of model weights):
```bash
cd services/detector && ../../.venv-detector/Scripts/python -m uvicorn app.main:app --port 8081
```

Run the end-to-end spine against a URL:
```bash
cd services/agents && ../../.venv-agents/Scripts/python -m truetrace.scripts.e2e --url "<video url>"
```

Tests:
```bash
cd services/detector && ../../.venv-detector/Scripts/python -m pytest -q
```

## Privacy properties currently enforced

- The source video is fetched to a temp directory, hashed, sampled, and
  **deleted**. It is never uploaded to cloud storage.
- Only ~16 sampled JPEG frames reach the detector. It never sees the URL, the
  video, or any user identifier.
- Gemini (once wired) receives **derived numeric signals only** - never a face,
  never the URL. The free tier is human-reviewable, so this is not optional.

## Known limitations

The detector produces a **risk band, never a verdict**, and returns
`INCONCLUSIVE` rather than guessing when too few frames contain a usable face.
The current band thresholds are **not yet calibrated** and have produced a false
positive on authentic footage. Do not present scores to users until the
calibration work in the findings doc is done.
