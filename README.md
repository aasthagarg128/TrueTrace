# TrueTrace

Privacy-first tooling for people whose likeness has been used in a manipulated
video: detect it, document it as evidence, and file the right takedown report.

> **Status: working end to end, locally.** Public site, pseudonymous accounts,
> and the full intake -> screening -> evidence -> report pipeline all run. See
> [docs/detection-findings.md](docs/detection-findings.md) for measured detector
> accuracy before relying on any screening result.

## Layout

```
apps/web/            Next.js app: public site, auth, and the private dashboard
services/detector/   CPU inference: face crop -> screening band
services/agents/     Intake, evidence, reporting; the HTTP API; accounts
docs/                Findings and design notes
```

The two Python services have **separate virtualenvs and requirements**, because
MediaPipe pins protobuf <5 while the Google Cloud client libraries require >=5.
They deploy as separate Cloud Run services, so this is not a workaround.

## Prerequisites

Python 3.11, Node 20+, and roughly 2 GB of disk for the model weights and
dependencies. No cloud account is needed; nothing here costs anything to run.

## Setup (once)

```bash
python -m venv .venv-detector && .venv-detector/Scripts/pip install -r services/detector/requirements.txt
```
```bash
python -m venv .venv-agents && .venv-agents/Scripts/pip install -r services/agents/requirements.txt
```
```bash
cd apps/web && npm install
```

Create `.env` in the repo root from `.env.example`. Two values must be set or
the app falls back to per-process keys and drops all sessions and evidence
access on restart:

```bash
cd services/agents && ../../.venv-agents/Scripts/python -c "from truetrace.core.crypto import generate_key; print('EVIDENCE_KEY=' + generate_key())"
```
```bash
python -c "import secrets; print('AUTH_SECRET=' + secrets.token_urlsafe(32))"
```

Also create `apps/web/.env.local`:

```bash
echo NEXT_PUBLIC_API_URL=http://127.0.0.1:8080 > apps/web/.env.local
```

## Run

Three services, each in its own terminal. Start them in this order — the API
health check reports the detector as unreachable until it is up.

**1. Detector** (first run downloads ~330 MB of model weights):
```bash
cd services/detector && ../../.venv-detector/Scripts/python -m uvicorn app.main:app --port 8081
```

**2. API** (loads `.env` for the evidence key and auth secret):
```bash
cd services/agents && ../../.venv-agents/Scripts/python -m uvicorn truetrace.api:app --port 8080
```

**3. Web app:**
```bash
cd apps/web && npm run dev
```

Then open `http://localhost:3000`, create an account, and start a case.

Check everything is up:
```bash
curl -s http://127.0.0.1:8080/healthz
```

## Tests

```bash
cd services/detector && ../../.venv-detector/Scripts/python -m pytest -q
```
```bash
cd services/agents && ../../.venv-agents/Scripts/python -m pytest -q
```
```bash
cd apps/web && npm run build
```

## Command-line pipeline (no web app)

The whole flow also runs headless, which is the quickest way to check the
backend without the frontend:

```bash
cd services/agents && ../../.venv-agents/Scripts/python -m truetrace.scripts.e2e --url "<video url>"
```

## Privacy properties currently enforced

- The source video is fetched to a temp directory, hashed, sampled, and
  **deleted**. It is never uploaded to cloud storage.
- Only ~16 sampled JPEG frames reach the detector. It never sees the URL, the
  video, or any user identifier.
- Gemini (once wired) receives **derived numeric signals only** - never a face,
  never the URL. The free tier is human-reviewable, so this is not optional.

## Detection: measured, weak, and honestly reported

Five free checkpoints were compared on 40 real + 38 fake real-world social media
videos. Most were useless - two scored *below* chance, one called everything
real, another called everything fake. The best,
`prithivMLmods/deepfake-detector-model-v1`, reaches **AUC 0.701** using the
maximum per-frame score.

(The newer "v2" model scored 0.470, below chance. Version numbers on model cards
are not evidence.)

At the chosen conservative threshold of 0.90:

| | value |
|---|---|
| precision | 0.77 |
| recall | 0.61 |
| false-positive rate | 0.17 |

**The output is three states, never a graded risk number.** AUC 0.701 is real
signal, but nowhere near enough to justify "risk 0.62":

- `INCONCLUSIVE` - too few usable frames; no conclusion either way.
- `FLAGGED` - always published with "roughly 23% of flagged videos are authentic".
- `NOT_FLAGGED` - always published with "this is NOT a finding that the video is
  authentic; the screening misses roughly 39% of manipulated videos".

That asymmetry is deliberate: a victim must never read a non-flag as reassurance.
Method and full numbers: [docs/detection-findings.md](docs/detection-findings.md).

## Takedown reports

The report is grounded in **the reporting person's assertion** of non-consent plus
cryptographic provenance - never in the detector's opinion. That is how these
policies actually work: platforms act on the affected person's statement, and
under the US TAKE IT DOWN Act must remove non-consensual intimate imagery,
explicitly including AI-generated depictions, within 48 hours.

Reporting routes for YouTube, Meta, X and TikTok are hand-curated and stamped
with a `verified_on` date rather than retrieved by RAG - for four platforms that
is more accurate, needs no index, and cannot hallucinate a reporting URL, which
here would send someone to a dead end at their worst moment.

## Evidence packages

Sealed with AES-256-GCM. The manifest hash is bound in as associated data, so a
package cannot be re-pointed at a different manifest, and every frame carries its
own SHA-256 so a single altered frame is detectable. Archives are reproducible:
identical evidence yields an identical archive hash, and only the nonce varies.

Anyone with the key can verify a package independently, from the file alone:

```bash
python -m truetrace.core.verify --package out/case-<id>.ttz
```
