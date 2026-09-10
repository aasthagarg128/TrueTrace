import Link from "next/link";
import { isBusy, shortRef, type CaseSummary } from "@/lib/api";

/** Platform name from a URL, for the card subtitle. Falls back to the host. */
function platformOf(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (host.includes("youtu")) return "YouTube";
    if (/facebook|instagram|threads|fb\.watch/.test(host)) return "Meta";
    if (/^(x|twitter)\.com$|^t\.co$/.test(host)) return "X";
    if (host.includes("tiktok")) return "TikTok";
    return host;
  } catch {
    return "Unknown source";
  }
}

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  fetching: "Retrieving",
  hashing: "Fingerprinting",
  sampling: "Sampling frames",
  verifying_identity: "Confirming identity",
  screening: "Screening",
  sealing: "Sealing evidence",
  complete: "Ready",
  failed: "Could not retrieve",
};

export default function CaseCard({ c }: { c: CaseSummary }) {
  const busy = isBusy(c.status);
  // Band language stays the honest three-state vocabulary. There is deliberately
  // no 0-100 score anywhere: the detector's measured AUC cannot support one.
  const band =
    c.band === "flagged" ? "Screening flagged it"
    : c.band === "not_flagged" ? "Not flagged"
    : c.band === "inconclusive" ? "Inconclusive"
    : null;

  return (
    <Link
      href={`/cases/${c.case_id}`}
      className="tt-card tt-lift block rounded-xl border border-line p-5 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm font-medium text-ink">{shortRef(c.case_id)}</span>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs ${
            c.status === "failed"
              ? "border-line text-subtle"
              : c.band === "flagged"
                ? "border-attention text-attention"
                : busy
                  ? "border-accent text-accent"
                  : "border-line text-muted"
          }`}
        >
          {STATUS_LABEL[c.status] ?? c.status}
        </span>
      </div>

      <p className="mt-1.5 text-sm text-muted">{platformOf(c.source_url)}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-subtle">
        {band && <span>{band}</span>}
        <span>Created {new Date(c.created_at).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}
