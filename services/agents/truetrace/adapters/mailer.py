"""Sending the password-reset email.

Delivery sits behind an interface because it is the one part of this flow that
cannot work without infrastructure the project does not own. With no SMTP
configured, `ConsoleMailer` logs the link instead of silently dropping it — a
reset that vanishes with no trace is far worse to debug than one printed to a
terminal, and in local development it is exactly what you want.

Nothing here is Google-specific: any SMTP provider works, including Gmail with
an app password.
"""
from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage
from typing import Protocol

log = logging.getLogger(__name__)


class Mailer(Protocol):
    def send_reset(self, to: str, link: str) -> None: ...


def _body(link: str) -> tuple[str, str]:
    subject = "Reset your TrueTrace password"
    text = (
        "Someone asked to reset the password on your TrueTrace account.\n\n"
        f"{link}\n\n"
        "This link works once and expires in 30 minutes.\n\n"
        "If this wasn't you, nothing has changed and you can ignore this message. "
        "Your password stays as it is.\n"
    )
    return subject, text


class ConsoleMailer:
    """Logs the link. The default, so the flow is fully testable offline."""

    def send_reset(self, to: str, link: str) -> None:
        subject, _ = _body(link)
        log.warning(
            "NO SMTP CONFIGURED - reset email not sent.\n"
            "  to      : %s\n"
            "  subject : %s\n"
            "  link    : %s",
            to, subject, link,
        )


class SmtpMailer:
    """Real delivery. Credentials come from the environment only."""

    def __init__(self) -> None:
        self.host = os.environ["SMTP_HOST"]
        self.port = int(os.getenv("SMTP_PORT", "587"))
        self.user = os.getenv("SMTP_USER", "")
        self.password = os.getenv("SMTP_PASSWORD", "")
        self.sender = os.getenv("SMTP_FROM", self.user or "no-reply@truetrace.local")

    def send_reset(self, to: str, link: str) -> None:
        subject, text = _body(link)
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = self.sender
        msg["To"] = to
        msg.set_content(text)

        with smtplib.SMTP(self.host, self.port, timeout=20) as smtp:
            smtp.starttls()
            if self.user:
                smtp.login(self.user, self.password)
            smtp.send_message(msg)
        log.info("reset email sent")


def build_mailer() -> Mailer:
    if os.getenv("SMTP_HOST", "").strip():
        try:
            mailer = SmtpMailer()
            log.info("email delivery: SMTP via %s", mailer.host)
            return mailer
        except Exception as exc:
            # Misconfigured mail must not stop the service from starting, and
            # must not look like it worked either.
            log.error("SMTP_HOST is set but SMTP is unusable (%s); logging links instead", exc)
    log.info("email delivery: console (no SMTP configured)")
    return ConsoleMailer()
