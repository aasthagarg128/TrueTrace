"""Drafting a platform-correct takedown report.

Design constraint that shapes everything here: the report is grounded in the
**reporting person's assertion** that they are depicted without consent, plus
documented provenance - NOT in the detector's opinion.

That is not a workaround for a weak model. It is how these policies actually
work: platforms act on NCII and impersonation reports on the basis of the
affected person's statement, and under the US TAKE IT DOWN Act they must do so
within 48 hours. A detector score is not required, and asserting one we cannot
substantiate would both weaken the report and mislead the user.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from textwrap import fill

from .platforms import ESCALATION, Platform, identify

WIDTH = 76


@dataclass
class ReportInput:
    case_id: str
    source_url: str
    fetched_at: datetime
    video_sha256: str
    manifest_sha256: str
    reporter_name: str | None  # None => pseudonymous
    reporter_contact: str | None
    depicts_reporter: bool
    consent_given: bool
    is_intimate: bool
    jurisdiction: str = "US"
    analysis: dict | None = None
    extra_context: str | None = None


@dataclass
class DraftedReport:
    platform: Platform | None
    subject: str
    body: str
    routes: list
    checklist: list[str]
    warnings: list[str]


def _wrap(text: str) -> str:
    return fill(text, WIDTH, initial_indent="  ", subsequent_indent="  ")


def _screening_line(analysis: dict | None) -> str:
    """State the automated result honestly, or say plainly that it is unusable.

    The detector's measured AUC is at or near chance (see
    docs/detection-findings.md), so this function never presents a score as
    supporting evidence. Overstating it would be the single most harmful thing
    this product could do.
    """
    if not analysis:
        return "No automated screening was performed on this content."
    band = (analysis.get("band") or "").lower()
    if band == "inconclusive":
        return (
            "An automated screening of sampled frames did not produce a usable "
            "result, and is therefore not offered as evidence of manipulation. "
            "This report rests on the statement of the person depicted."
        )
    return (
        "An automated screening was performed, but its reliability has not been "
        "established and it is not offered as evidence of manipulation. This "
        "report rests on the statement of the person depicted."
    )


def draft(inp: ReportInput) -> DraftedReport:
    platform = identify(inp.source_url)
    warnings: list[str] = []

    if not inp.depicts_reporter:
        warnings.append(
            "You indicated the content does not depict you. Most NCII and privacy "
            "routes require the report to come from the person depicted or their "
            "authorised representative."
        )
    if inp.consent_given:
        warnings.append(
            "You indicated consent was given. NCII policies turn on the absence of "
            "consent; this report is unlikely to succeed as filed."
        )
    if platform is None:
        warnings.append(
            "The host was not recognised, so this is a generic report. Send it to "
            "the site's abuse contact, and to its hosting provider if there is none."
        )

    who = inp.reporter_name or "The reporting party (identity withheld)"
    fetched = inp.fetched_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    header = f"To the {platform.display_name if platform else 'site'} Trust & Safety team,"

    policy_line = (
        f"This content violates {platform.display_name}'s "
        f"{', '.join(platform.policy_names[:2])} policy."
        if platform
        else "This content is non-consensual intimate or manipulated imagery of a real person."
    )

    statutory = ""
    if inp.jurisdiction.upper() == "US" and inp.is_intimate:
        statutory = "\n\n" + _wrap(
            "This request is submitted under the US TAKE IT DOWN Act, which "
            "requires covered platforms to remove non-consensual intimate "
            "imagery - including AI-generated and synthetic depictions - within "
            "48 hours of a valid request."
        )

    statement = _wrap(
        f"{who} states that they are the person depicted in this content, and that "
        f"they did not consent to its creation or publication. The content appears "
        f"to have been created or altered to depict them without their knowledge."
    )
    provenance = _wrap(
        "An evidence record was generated at the time of documentation. It contains "
        "the retrieved content's cryptographic hash, the retrieval timestamp, and "
        "hashes of each frame examined, so the material described here can be "
        "verified as unmodified."
    )

    if inp.reporter_contact:
        contact_block = "CONTACT\n  " + inp.reporter_contact
    else:
        contact_block = (
            "CONTACT\n  Withheld. Please advise the minimum contact detail "
            "required to proceed."
        )

    context_block = ""
    if inp.extra_context:
        context_block = "\nADDITIONAL CONTEXT\n" + _wrap(inp.extra_context) + "\n"

    subject = (
        f"Removal request: non-consensual {'intimate ' if inp.is_intimate else ''}"
        f"imagery depicting the reporting party ({inp.case_id})"
    )

    body = f"""{header}

I am writing to request the removal of content that depicts me without my consent.

CONTENT
  URL          {inp.source_url}
  Documented   {fetched}

STATEMENT
{statement}

{_wrap(policy_line)}{statutory}

PROVENANCE
{provenance}

  Content SHA-256   {inp.video_sha256}
  Evidence manifest {inp.manifest_sha256}

{_wrap(_screening_line(inp.analysis))}

REQUESTED ACTION
  1. Remove the content identified above.
  2. Prevent re-upload of the same content where hash-matching is available.
  3. Confirm the outcome to the contact address below.

{contact_block}
{context_block}
Regards,
{who}
"""

    checklist = [
        "Confirm the URL still resolves before submitting.",
        "Keep the evidence package to hand; do not attach it unless asked.",
    ]
    if platform:
        checklist.append(f"Expected response: {platform.typical_sla}")
        checklist += [f"Provide: {item}" for item in platform.evidence_expected]
        if platform.stopncii_partner:
            checklist.append(
                "This platform participates in StopNCII.org - submitting a hash "
                "there blocks re-uploads without ever sending the image itself."
            )
        checklist.append(f"Identity: {platform.identity_required}")
    checklist.append("If the platform does not act, escalate via the routes listed.")

    return DraftedReport(
        platform=platform,
        subject=subject,
        body=body,
        routes=(platform.routes if platform else []) + ESCALATION,
        checklist=checklist,
        warnings=warnings,
    )
