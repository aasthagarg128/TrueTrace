"""Plain-language explanations of a screening result, via Gemini.

The hard rule in this module is what Gemini is allowed to see.

TrueTrace fetches videos of people in the worst moment of their lives. Google's
free Gemini tier states that prompts may be reviewed by humans and used to
improve their models, and Google tells users not to send sensitive or personal
information to non-paid services. So the payload is built from an explicit
ALLOWLIST of numeric signals — never the URL, never a frame, never a case id,
never anything about the account. `build_payload` is the only way to construct a
prompt, and `assert_safe` re-checks the finished string before it is sent.

The second rule is what Gemini is allowed to decide: nothing. The band and the
error rates are computed by `scoring.py` and passed in as fixed text. Gemini
rewrites them into readable prose. It never re-derives, softens, or contradicts
them, and if it fails or is not configured the template output is used verbatim.
"""
from __future__ import annotations

import logging
import os
from typing import Any

log = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-2.5-flash"

# The complete set of fields that may leave this process. Anything not named
# here cannot reach Gemini, including fields added to the analysis dict later.
ALLOWED_SIGNAL_KEYS = frozenset({
    "band",
    "frames_submitted",
    "frames_with_face",
    "frames_scored",
    "flagged_fraction",
    "dispersion",
    "peak_score",
})

# Substrings that must never appear in an outgoing prompt. A crude check on
# purpose: it catches the realistic mistake, which is someone widening the
# allowlist later without thinking about what it now admits.
_FORBIDDEN = ("http://", "https://", "case-", "u-", "@", "sha256", "base64", "/9j/")


class ExplainError(Exception):
    pass


def is_configured() -> bool:
    return bool(os.getenv("GEMINI_API_KEY", "").strip())


def build_payload(analysis: dict[str, Any]) -> dict[str, Any]:
    """Reduce a full analysis to the numeric signals Gemini may see.

    Built by allowlist rather than by deleting known-sensitive keys: a denylist
    silently leaks whatever gets added to the analysis dict next.
    """
    payload = {k: analysis.get(k) for k in ALLOWED_SIGNAL_KEYS if k in analysis}
    # `score` is the peak frame value; rename it so the prompt cannot be read as
    # a 0-100 risk score, which the detector does not support.
    if "score" in analysis and analysis["score"] is not None:
        payload["peak_score"] = analysis["score"]
    return payload


def assert_safe(prompt: str) -> None:
    """Last line of defence before anything is sent."""
    lowered = prompt.lower()
    for token in _FORBIDDEN:
        if token in lowered:
            raise ExplainError(
                f"refusing to send a prompt containing {token!r} to Gemini"
            )


_SYSTEM = """You explain automated screening results to people who have just \
discovered a manipulated video of themselves. They are frightened and may not be \
technical.

Rules you must follow exactly:
- Never state or imply that the video IS or IS NOT manipulated. The screening is \
indicative only.
- Never invent a percentage, score, or confidence figure. Use only numbers given to you.
- Never reassure. If the screening did not flag the content, that is not evidence \
the video is authentic, and you must not let it read that way.
- Do not speculate about who made the video or why.
- Write 2-3 short sentences in plain language. No jargon, no bullet points, no headings.
- Calm and direct. Do not be dramatic and do not apologise."""


def _prompt(signals: dict[str, Any], limitations: list[str]) -> str:
    lines = [
        "Explain this automated screening result.",
        "",
        "Signals (all derived measurements, no content):",
    ]
    for key, value in sorted(signals.items()):
        lines.append(f"- {key}: {value}")
    lines += [
        "",
        "These facts are already established and must not be contradicted:",
    ]
    lines += [f"- {item}" for item in limitations]
    return "\n".join(lines)


def explain(
    analysis: dict[str, Any],
    limitations: list[str],
    *,
    timeout_s: float = 12.0,
) -> str | None:
    """Return a plain-language explanation, or None to use the template output.

    None is a completely acceptable outcome. The templates in `scoring.py` are
    already accurate and carry the measured error rates; Gemini makes them
    friendlier, and nothing depends on it succeeding.
    """
    if not is_configured():
        return None

    try:
        from google import genai
        from google.genai import types

        signals = build_payload(analysis)
        prompt = _prompt(signals, limitations)
        assert_safe(prompt)

        client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", DEFAULT_MODEL),
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM,
                temperature=0.2,          # explanation, not creative writing
                max_output_tokens=220,
                http_options=types.HttpOptions(timeout=int(timeout_s * 1000)),
            ),
        )
        text = (response.text or "").strip()
        if not text:
            return None
        return text

    except ExplainError:
        # A safety check tripped. Never fall through to sending it anyway.
        log.exception("explanation payload rejected by safety check")
        return None
    except Exception as exc:
        # Quota, network, model change, SDK change. The case still completes.
        log.warning("gemini explanation unavailable (%s); using template text", exc)
        return None
