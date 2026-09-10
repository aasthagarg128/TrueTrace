"""Curated registry of statutory takedown regimes, by jurisdiction.

Same discipline as `platforms.py`, for the same reason: this is a legal
claim inserted into a report a frightened person is about to send, so
curation beats generation. A hallucinated statute name or a wrong deadline
here is worse than useless — it makes the report look uninformed exactly
where it needs to look authoritative.

This is NOT legal advice, and the report says so. It cites publicly reported
statutory deadlines and the correct regulator, nothing more. `status` records
whether a law is in force or still moving through a legislature, because
citing a bill as if it were already binding would be worse than citing
nothing.

Researched and dated 2026-09-11. Sources are listed on each entry so a future
re-check knows what to verify, not just that it should.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from .platforms import ReportRoute


@dataclass(frozen=True)
class Jurisdiction:
    code: str
    display_name: str
    status: str  # "in force" | "pending enactment"
    statutory_note: str  # inserted into the report body when it applies
    regulator_routes: list[ReportRoute]
    verified_on: date
    sources: list[str] = field(default_factory=list)


RESEARCHED = date(2026, 9, 11)

JURISDICTIONS: dict[str, Jurisdiction] = {
    "US": Jurisdiction(
        code="US",
        display_name="United States",
        status="in force",
        statutory_note=(
            "This request is submitted under the US TAKE IT DOWN Act, which "
            "requires covered platforms to remove non-consensual intimate "
            "imagery - including AI-generated and synthetic depictions - "
            "within 48 hours of a valid request."
        ),
        regulator_routes=[
            ReportRoute("FTC TAKE IT DOWN reporting", "https://takeitdown.ftc.gov",
                        "Report platforms that fail to remove NCII or obstruct reporting."),
        ],
        verified_on=RESEARCHED,
        sources=["https://en.wikipedia.org/wiki/TAKE_IT_DOWN_Act"],
    ),
    "UK": Jurisdiction(
        code="UK",
        display_name="United Kingdom",
        status="in force",
        statutory_note=(
            "This request is submitted under the UK Online Safety Act, as "
            "strengthened for intimate image abuse: non-consensual intimate "
            "imagery, including AI-generated and digitally altered depictions "
            "under the amended Sexual Offences Act 2003, is treated as a "
            "priority-offence category and platforms are required to remove "
            "reported content within 48 hours and to use hash-matching to "
            "prevent re-upload."
        ),
        regulator_routes=[
            ReportRoute("Ofcom online safety complaints", "https://www.ofcom.org.uk/online-safety/",
                        "UK regulator for platforms that fail to act under the Online Safety Act."),
            ReportRoute("Revenge Porn Helpline", "https://revengepornhelpline.org.uk",
                        "UK support service that can assist with removal, including StopNCII."),
        ],
        verified_on=RESEARCHED,
        sources=[
            "https://www.computing.co.uk/news/2026/government/uk-to-force-platforms-to-take-down-abusive-images-in-48-hours",
            "https://dig.watch/updates/uk-online-safety-act-protections-intimate-image-abuse",
        ],
    ),
    "EU": Jurisdiction(
        code="EU",
        display_name="European Union",
        status="in force",
        statutory_note=(
            "This request is submitted under the EU Digital Services Act, "
            "which obliges online platforms to remove illegal content, "
            "including non-consensual intimate imagery, promptly once they "
            "are made aware of it through a notice-and-action mechanism. "
            "Separate EU-level rules banning non-consensual AI 'nudification' "
            "are in development and may add further obligations."
        ),
        regulator_routes=[
            ReportRoute("EU Digital Services Act contact points",
                        "https://digital-strategy.ec.europa.eu/en/policies/dsa-contact-points",
                        "Find your national Digital Services Coordinator if a platform does not act."),
        ],
        verified_on=RESEARCHED,
        sources=[
            "https://www.techpolicy.press/eu-moves-to-regulate-ai-nudification-but-key-challenges-remain/",
            "https://www.euronews.com/my-europe/2026/05/19/not-without-my-consent-how-europe-plans-to-ban-non-consensual-nudifier-apps",
        ],
    ),
    "IN": Jurisdiction(
        code="IN",
        display_name="India",
        status="in force",
        statutory_note=(
            "This request is submitted under India's Information Technology "
            "Rules, 2021 (as amended), which require intermediaries to act on "
            "non-consensual intimate imagery and AI-generated impersonation "
            "urgently - within 2 hours for non-consensual intimate content - "
            "or lose their safe-harbour protection under Section 79 of the IT "
            "Act, 2000. A Grievance Officer must be appointed to receive this "
            "request."
        ),
        regulator_routes=[
            ReportRoute("Grievance Appellate Committee",
                        "https://gac.gov.in",
                        "Escalation if the platform's own Grievance Officer does not act in time."),
            ReportRoute("National Cyber Crime Reporting Portal",
                        "https://cybercrime.gov.in",
                        "For content that is also being reported as a crime."),
        ],
        verified_on=RESEARCHED,
        sources=[
            "https://techobserver.in/news/policy/india-deepfake-rules-content-takedown-3-hours-327180/",
            "https://www.vaishlaw.com/india-it-rules-before-and-after-amendment-ai-generated-content/",
        ],
    ),
    "AU": Jurisdiction(
        code="AU",
        display_name="Australia",
        status="in force",
        statutory_note=(
            "This request is submitted under the Australian Online Safety Act "
            "2021, image-based abuse scheme. eSafety can order removal of "
            "intimate images shared without consent, whether real or digitally "
            "created, and platforms that do not comply can face civil "
            "penalties."
        ),
        regulator_routes=[
            ReportRoute("eSafety Commissioner - report image-based abuse",
                        "https://www.esafety.gov.au/report",
                        "Australia's regulator can compel removal and has issued penalties for non-compliance."),
        ],
        verified_on=RESEARCHED,
        sources=[
            "https://www.esafety.gov.au/newsroom/blogs/addressing-deepfake-image-based-abuse",
            "https://www.esafety.gov.au/newsroom/media-releases/court-orders-343500-penalty-for-posting-deepfakes-of-australian-women",
        ],
    ),
    "CA": Jurisdiction(
        code="CA",
        display_name="Canada",
        # As of the research date, the federal 48-hour takedown bill (C-16) had
        # passed committee but not received royal assent. Citing it as binding
        # federal law would overstate it, so this stays a soft reference and
        # points instead to the provincial law that IS in force.
        status="pending enactment (federal); in force (British Columbia)",
        statutory_note=(
            "A federal law (Bill C-16) that would impose a 48-hour platform "
            "takedown deadline for non-consensual intimate images, including "
            "AI-generated ones, is moving through Parliament but has not yet "
            "received royal assent. British Columbia's Intimate Images "
            "Protection Act is already in force and allows a tribunal to "
            "order removal directly."
        ),
        regulator_routes=[
            ReportRoute("BC Civil Resolution Tribunal - intimate images",
                        "https://www2.gov.bc.ca/gov/content/safety/public-safety/intimate-images/image-removal-reporting",
                        "In-force route for BC residents; can order platforms to remove content."),
        ],
        verified_on=RESEARCHED,
        sources=[
            "https://refdesk.ca/blog/bill-c16-deepfake-nearly-nude-amendment-may-11-2026-victims-rights-guide",
            "https://www2.gov.bc.ca/gov/content/safety/public-safety/intimate-images/intimate-images-consent",
        ],
    ),
}

# Shown whenever a jurisdiction outside this registry is selected, or none is.
GENERIC_NOTE = (
    "No jurisdiction-specific statutory deadline is cited for this request. "
    "Most major platforms remove non-consensual intimate imagery under their "
    "own policies regardless of where the reporting person is located; the "
    "policy-based request above still applies."
)

DISCLAIMER = (
    "This report cites publicly reported laws and regulators as background, "
    "not as legal advice. Laws in this area are changing quickly; consult a "
    "local lawyer or support service if you need advice on your specific "
    "situation."
)


def get(code: str | None) -> Jurisdiction | None:
    return JURISDICTIONS.get((code or "").upper())
