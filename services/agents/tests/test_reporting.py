"""The report must be correct for the platform, and must never overstate detection."""
from datetime import datetime, timezone

import pytest

from truetrace.reporting.drafter import ReportInput, draft
from truetrace.reporting.jurisdictions import JURISDICTIONS
from truetrace.reporting.platforms import PLATFORMS, identify


def _flat(text: str) -> str:
    """Collapse the report's word-wrapping so a multi-word phrase can be
    matched even when fill() happened to break a line between its words."""
    return " ".join(text.split())


def make(**over):
    base = dict(
        case_id="case-1",
        source_url="https://www.instagram.com/p/abc/",
        fetched_at=datetime(2026, 8, 28, 14, 0, tzinfo=timezone.utc),
        video_sha256="a" * 64,
        manifest_sha256="b" * 64,
        reporter_name=None,
        reporter_contact=None,
        depicts_reporter=True,
        consent_given=False,
        is_intimate=True,
        analysis={"band": "inconclusive", "score": None},
    )
    base.update(over)
    return ReportInput(**base)


@pytest.mark.parametrize(
    "url,expected",
    [
        ("https://youtu.be/abc", "youtube"),
        ("https://www.instagram.com/p/abc/", "meta"),
        ("https://x.com/u/status/1", "x"),
        ("https://www.tiktok.com/@u/video/1", "tiktok"),
    ],
)
def test_platform_routing(url, expected):
    assert identify(url).key == expected


def test_unknown_host_yields_generic_report_not_a_wrong_one():
    r = draft(make(source_url="https://some-random-host.example/v/1"))
    assert r.platform is None
    assert any("not recognised" in w for w in r.warnings)


def test_report_never_claims_the_detector_found_manipulation():
    for band in ("inconclusive", "high", "low", "moderate"):
        r = draft(make(analysis={"band": band, "score": 0.9}))
        low = r.body.lower()
        # The single most harmful failure mode: presenting a near-chance model
        # as proof. Guard it explicitly for every band.
        assert "not offered as evidence" in low
        assert "0.9" not in r.body
        assert "rests on the statement" in low


def test_report_omits_score_even_when_analysis_absent():
    r = draft(make(analysis=None))
    assert "no automated screening was performed" in r.body.lower()


def test_pseudonymous_report_leaks_no_identity():
    r = draft(make(reporter_name=None, reporter_contact=None))
    assert "identity withheld" in r.body.lower()
    assert "Withheld" in r.body


def test_named_reporter_is_used_when_supplied():
    r = draft(make(reporter_name="A. Person", reporter_contact="a@example.test"))
    assert "A. Person" in r.body
    assert "a@example.test" in r.body


def test_us_intimate_report_invokes_take_it_down_act():
    r = draft(make(jurisdiction="US", is_intimate=True))
    assert "TAKE IT DOWN Act" in r.body
    assert "48 hours" in r.body


def test_non_us_report_does_not_invoke_us_statute():
    r = draft(make(jurisdiction="DE"))
    assert "TAKE IT DOWN Act" not in r.body


def test_unrecognised_jurisdiction_gets_generic_note_not_silence():
    r = draft(make(jurisdiction="ZZ", is_intimate=True))
    assert "No jurisdiction-specific statutory deadline" in r.body


@pytest.mark.parametrize("code", ["UK", "EU", "IN", "AU", "CA"])
def test_each_jurisdiction_cites_its_own_statute_and_disclaims_advice(code):
    r = draft(make(jurisdiction=code, is_intimate=True))
    j = JURISDICTIONS[code]
    # A word unique to that jurisdiction's note, not shared with any other --
    # guards against one jurisdiction's text silently leaking into another's.
    assert j.statutory_note.split()[0] in r.body or j.display_name in r.body
    assert "not as legal advice" in _flat(r.body).lower()
    # Every regulator route for the selected jurisdiction must reach the
    # reader -- this is the actual escalation path if the platform stalls.
    urls = [x.url for x in r.routes]
    for route in j.regulator_routes:
        assert route.url in urls


def test_pending_jurisdiction_is_flagged_not_overstated():
    """Canada's federal bill had not received royal assent as of research date.
    Citing it as settled law would be worse than citing nothing."""
    r = draft(make(jurisdiction="CA", is_intimate=True))
    assert any("not fully in force" in w for w in r.warnings)
    assert "British Columbia" in r.body


def test_non_intimate_report_cites_no_statute_for_any_jurisdiction():
    """The statutory routes are all NCII-specific; a non-intimate report must
    not borrow one it does not qualify for."""
    for code in list(JURISDICTIONS) + ["ZZ"]:
        r = draft(make(jurisdiction=code, is_intimate=False))
        assert "not as legal advice" not in _flat(r.body).lower()


def test_every_jurisdiction_entry_is_well_formed():
    for code, j in JURISDICTIONS.items():
        assert j.code == code
        assert j.statutory_note and j.display_name
        assert j.status in ("in force",) or "pending" in j.status
        assert all(r.url.startswith("https://") for r in j.regulator_routes)
        assert j.sources, f"{code} has no source citation"


def test_provenance_hashes_are_present():
    r = draft(make())
    assert "a" * 64 in r.body
    assert "b" * 64 in r.body


def test_consent_given_is_flagged_as_a_problem():
    r = draft(make(consent_given=True))
    assert any("consent was given" in w for w in r.warnings)


def test_not_depicted_is_flagged_as_a_problem():
    r = draft(make(depicts_reporter=False))
    assert any("does not depict you" in w for w in r.warnings)


def test_stopncii_is_offered_for_partner_platforms():
    r = draft(make(source_url="https://www.tiktok.com/@u/video/1"))
    assert any("StopNCII" in c for c in r.checklist)


def test_escalation_routes_always_present():
    r = draft(make())
    urls = [x.url for x in r.routes]
    assert "https://takeitdown.ftc.gov" in urls


def test_every_platform_entry_is_well_formed():
    for key, p in PLATFORMS.items():
        assert p.key == key
        assert p.routes and all(r.url.startswith("https://") for r in p.routes)
        assert p.policy_names and p.evidence_expected
        assert p.verified_on is not None
