"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listCases, ownerId, type CaseSummary } from "@/lib/api";

/**
 * A person can have more than one case — content resurfaces, or is posted in
 * several places at once. Without this page, a case is only reachable by a link
 * they had to keep.
 *
 * Deliberately shows no preview images: a list is somewhere you land by
 * accident, and it must never surprise someone with the content.
 */
export default function CasesPage() {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCases(ownerId())
      .then(setCases)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Your cases</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Kept on this device only. There is no account, so clearing your browser data
          or switching devices will lose this list — save any case link you want to
          keep.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-attention-line bg-attention-bg px-4 py-3 text-sm text-attention">
          Could not load your cases: {error}
        </p>
      )}

      {cases === null && !error && <p className="text-sm text-subtle">Loading…</p>}

      {cases?.length === 0 && (
        <section className="tt-card rounded-xl border border-line p-8 text-center">
          <p className="text-sm text-muted">You have no cases yet.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:opacity-90"
          >
            Document something
          </Link>
        </section>
      )}

      {cases && cases.length > 0 && (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li key={c.case_id}>
              <Link
                href={`/case?id=${c.case_id}`}
                className="tt-card tt-lift block rounded-xl border border-line p-4 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs text-subtle">{c.case_id}</span>
                  <StatusPill status={c.status} band={c.band} />
                </div>
                <p className="mt-2 truncate text-sm text-muted">{c.source_url}</p>
                <p className="mt-1 text-xs text-subtle">
                  {new Date(c.created_at).toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ status, band }: { status: string; band: string | null }) {
  const label =
    status === "complete" ? (band === "flagged" ? "Flagged" : "Recorded") :
    status === "failed" ? "Could not retrieve" : "In progress";
  const tone =
    status === "failed"
      ? "border-line text-muted"
      : status === "complete"
        ? band === "flagged"
          ? "border-attention text-attention"
          : "border-line text-muted"
        : "border-line text-muted";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs ${tone}`}>{label}</span>
  );
}
