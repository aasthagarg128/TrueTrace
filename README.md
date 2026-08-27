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
