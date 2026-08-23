"""Getting pixels from a URL without the user re-uploading anything.

Platform ToS varies on automated fetching and yt-dlp extractors break without
warning, so this sits behind a Protocol with a thumbnail-only fallback. Callers
must handle a degraded result rather than assuming a full video.
"""
from __future__ import annotations

import logging
import os
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

log = logging.getLogger(__name__)

# Cap what we pull. A user's link can point at a two-hour stream, and we only
# ever look at ~16 frames of it.
_MAX_HEIGHT = 720

# Several hosts (Wikimedia among them) reject the default yt-dlp User-Agent
# outright with a 403. Identifying ourselves honestly is also what Wikimedia's
# own bot policy asks for, so we do not disguise the client as a browser.
_USER_AGENT = os.getenv(
    "TRUETRACE_USER_AGENT",
    "TrueTrace/0.1 (deepfake evidence tooling; +https://github.com/truetrace)",
)
_HTTP_HEADERS = {"User-Agent": _USER_AGENT}


@dataclass
class FetchResult:
    video_path: Path | None
    fetched_at: datetime
    source_url: str
    metadata: dict = field(default_factory=dict)
    degraded: str | None = None  # set when we could not get full video

    @property
    def ok(self) -> bool:
        return self.video_path is not None and self.video_path.exists()


class Fetcher(Protocol):
    def fetch(self, url: str, workdir: Path) -> FetchResult: ...


class YtDlpFetcher:
    """Full-video fetch. Preferred, because single-frame analysis is much weaker."""

    def fetch(self, url: str, workdir: Path) -> FetchResult:
        import yt_dlp

        workdir.mkdir(parents=True, exist_ok=True)
        opts = {
            "outtmpl": str(workdir / "source.%(ext)s"),
            "format": f"best[height<={_MAX_HEIGHT}]/best",
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "nocheckcertificate": False,
            "http_headers": _HTTP_HEADERS,
        }

        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            path = Path(ydl.prepare_filename(info))

        return FetchResult(
            video_path=path if path.exists() else None,
            fetched_at=datetime.now(timezone.utc),
            source_url=url,
            metadata=_metadata(info),
            degraded=None if path.exists() else "download_produced_no_file",
        )


class ThumbnailFetcher:
    """ToS-safe fallback: the public preview image only.

    A single still is a much weaker basis for a score, which is why the result is
    marked degraded and the scoring layer will usually return Inconclusive.
    """

    def fetch(self, url: str, workdir: Path) -> FetchResult:
        import httpx
        import yt_dlp

        workdir.mkdir(parents=True, exist_ok=True)
        probe_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "http_headers": _HTTP_HEADERS,
        }
        with yt_dlp.YoutubeDL(probe_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        thumb = info.get("thumbnail")
        if not thumb:
            return FetchResult(
                video_path=None,
                fetched_at=datetime.now(timezone.utc),
                source_url=url,
                metadata=_metadata(info),
                degraded="no_thumbnail_available",
            )

        dest = workdir / "thumbnail.jpg"
        with httpx.stream(
            "GET", thumb, follow_redirects=True, timeout=30, headers=_HTTP_HEADERS
        ) as r:
            r.raise_for_status()
            with open(dest, "wb") as fh:
                for chunk in r.iter_bytes():
                    fh.write(chunk)

        return FetchResult(
            video_path=dest,
            fetched_at=datetime.now(timezone.utc),
            source_url=url,
            metadata=_metadata(info),
            degraded="thumbnail_only",
        )


class FallbackFetcher:
    """Try full video, fall back to thumbnail. What the Intake agent actually uses."""

    def __init__(self) -> None:
        self._primary = YtDlpFetcher()
        self._fallback = ThumbnailFetcher()

    def fetch(self, url: str, workdir: Path) -> FetchResult:
        try:
            result = self._primary.fetch(url, workdir)
            if result.ok:
                return result
            log.warning("full fetch produced no file, falling back to thumbnail")
        except Exception as exc:
            log.warning("full fetch failed (%s), falling back to thumbnail", exc)

        try:
            return self._fallback.fetch(url, workdir)
        except Exception as exc:
            log.error("thumbnail fetch also failed: %s", exc)
            return FetchResult(
                video_path=None,
                fetched_at=datetime.now(timezone.utc),
                source_url=url,
                degraded=f"fetch_failed: {exc}",
            )


def _metadata(info: dict) -> dict:
    """Only the fields that belong in an evidence manifest. Deliberately narrow:
    yt-dlp returns a great deal we have no business storing."""
    return {
        "title": info.get("title"),
        "uploader": info.get("uploader"),
        "uploader_id": info.get("uploader_id"),
        "upload_date": info.get("upload_date"),
        "duration_s": info.get("duration"),
        "canonical_url": info.get("webpage_url"),
        "extractor": info.get("extractor_key"),
        "width": info.get("width"),
        "height": info.get("height"),
    }
