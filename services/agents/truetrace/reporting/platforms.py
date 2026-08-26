"""Curated registry of platform reporting routes.

Deliberately hand-curated structured data rather than RAG over scraped policy
pages. For four platforms, curation is more accurate, cheaper (no index, no
embedding calls), and cannot hallucinate a reporting URL - which for this
product would send a victim to a dead end at their worst moment.

Every url here was verified against the platform's own help centre on
2026-08-28. `verified_on` exists so staleness is visible rather than assumed;
policies drift and this file needs periodic re-checking.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date


@dataclass(frozen=True)
class ReportRoute:
    name: str
    url: str
    note: str = ""


@dataclass(frozen=True)
class Platform:
    key: str
    display_name: str
    routes: list[ReportRoute]
    policy_names: list[str]
    evidence_expected: list[str]
    identity_required: str
    typical_sla: str
    verified_on: date
    stopncii_partner: bool = False
    notes: list[str] = field(default_factory=list)


VERIFIED = date(2026, 8, 28)

# The US TAKE IT DOWN Act (in full effect May 2026) requires covered platforms
# to remove non-consensual intimate imagery - explicitly including AI-generated
# and synthetic depictions - within 48 hours of a valid request. Several
# platforms now run a dedicated intake for it, which is usually the fastest and
# most enforceable route for a US-based reporter.
TAKE_IT_DOWN_SLA = "48 hours for valid NCII requests (US TAKE IT DOWN Act)"

PLATFORMS: dict[str, Platform] = {
    "youtube": Platform(
        key="youtube",
        display_name="YouTube",
        routes=[
            ReportRoute("NCII removal request",
                        "https://support.google.com/youtube/answer/17071740",
                        "Dedicated non-consensual intimate imagery flow, incl. synthetic content."),
            ReportRoute("Privacy complaint (likeness)",
                        "https://support.google.com/youtube/answer/142443",
                        "Use when the content is not intimate but uses your face or voice."),
            ReportRoute("Google Search / broader removal",
                        "https://support.google.com/accounts/answer/17045517",
                        "Removes results from Google Search as well as the hosted content."),
        ],
        policy_names=["Community Guidelines: non-consensual intimate imagery",
                      "Privacy Guidelines", "Synthetic and manipulated media"],
        evidence_expected=["Exact video URL", "Timestamps where you appear",
                           "Statement that you are depicted and did not consent"],
        identity_required="Legal name for privacy complaints; the form is not public.",
        typical_sla=TAKE_IT_DOWN_SLA,
        verified_on=VERIFIED,
        notes=["Google policy explicitly covers fake, AI-generated and synthetic imagery."],
    ),
    "meta": Platform(
        key="meta",
        display_name="Meta (Facebook / Instagram / Threads)",
        routes=[
            ReportRoute("NCII reporting",
                        "https://www.meta.com/help/policies/1437976901029950/"),
            ReportRoute("Intimate image abuse safety hub",
                        "https://www.meta.com/safety/topics/bullying-harassment/ncii/"),
            ReportRoute("StopNCII.org hash submission",
                        "https://stopncii.org",
                        "Submits a perceptual hash, NOT the image - preferred on privacy grounds."),
        ],
        policy_names=["Adult Sexual Exploitation", "Bullying and Harassment"],
        evidence_expected=["Post or profile URL", "Confirmation you are depicted"],
        identity_required="Pseudonymous reporting possible via StopNCII hashing.",
        typical_sla=TAKE_IT_DOWN_SLA,
        verified_on=VERIFIED,
        stopncii_partner=True,
        notes=["StopNCII hashing blocks re-uploads across partner platforms proactively."],
    ),
    "x": Platform(
        key="x",
        display_name="X (Twitter)",
        routes=[
            ReportRoute("Non-consensual nudity policy",
                        "https://help.x.com/en/rules-and-policies/intimate-media"),
            ReportRoute("US TAKE IT DOWN Act removal",
                        "https://help.x.com/en/rules-and-policies/us-tida",
                        "Statutory route; generally the strongest lever for US reporters."),
        ],
        policy_names=["Non-consensual nudity", "Synthetic and manipulated media"],
        evidence_expected=["Post URL", "Statement of non-consent"],
        identity_required="Contact details required for statutory requests.",
        typical_sla=TAKE_IT_DOWN_SLA,
        verified_on=VERIFIED,
        notes=["Policy explicitly covers faces digitally superimposed onto another body."],
    ),
    "tiktok": Platform(
        key="tiktok",
        display_name="TikTok",
        routes=[
            ReportRoute("Privacy / NCII report webform",
                        "https://www.tiktok.com/legal/report/privacy/webform/us/en",
                        "Covers NCII and sexually explicit synthetic media."),
            ReportRoute("StopNCII.org hash submission", "https://stopncii.org"),
        ],
        policy_names=["Sexual Exploitation and Gender-Based Violence",
                      "Synthetic media policy"],
        evidence_expected=["Video URL or @handle and post date",
                           "Statement that you are depicted and did not consent"],
        identity_required="Webform requests contact details; StopNCII route does not.",
        typical_sla=TAKE_IT_DOWN_SLA,
        verified_on=VERIFIED,
        stopncii_partner=True,
    ),
}

# Where to escalate when a platform does not act.
ESCALATION = [
    ReportRoute("FTC TAKE IT DOWN reporting",
                "https://takeitdown.ftc.gov",
                "Report platforms that fail to remove NCII or obstruct reporting."),
    ReportRoute("StopNCII.org",
                "https://stopncii.org",
                "Hash-based proactive blocking across partner platforms."),
]

# Host -> platform key. Kept small and explicit; an unknown host yields a
# generic report rather than a wrong-platform one.
_HOST_MAP = {
    "youtube.com": "youtube", "youtu.be": "youtube", "m.youtube.com": "youtube",
    "facebook.com": "meta", "instagram.com": "meta", "threads.net": "meta",
    "fb.watch": "meta", "m.facebook.com": "meta",
    "x.com": "x", "twitter.com": "x", "t.co": "x",
    "tiktok.com": "tiktok", "vm.tiktok.com": "tiktok",
}


def identify(url: str) -> Platform | None:
    """Best-effort platform match from a URL. Returns None rather than guessing."""
    from urllib.parse import urlparse

    host = (urlparse(url).hostname or "").lower().removeprefix("www.")
    return PLATFORMS.get(_HOST_MAP.get(host, ""))
