"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CaseCard from "@/components/CaseCard";
import { listCases, type CaseSummary } from "@/lib/api";

/**
 * All cases. Deliberately shows no preview images: a list is somewhere you land
 * by accident, and it must never surprise someone with their own content.
 */
export default function CasesPage() {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCases()
      .then(setCases)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My cases</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            Everything you have documented. Content often resurfaces — a case stays
            here so you never have to start over.
          </p>
        </div>
        <Link
          href="/cases/new"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition hover:opacity-90"
        >
          + New case
        </Link>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-attention-line bg-attention-bg px-4 py-3 text-sm text-attention">
          Could not load your cases: {error}
        </p>
      )}

      {cases === null && !error && <p className="text-sm text-subtle">Loading…</p>}

      {cases?.length === 0 && (
        <div className="tt-card rounded-xl border border-line p-10 text-center">
          <p className="text-sm text-muted">You have no cases yet.</p>
          <Link
            href="/cases/new"
            className="mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition hover:opacity-90"
          >
            Start a case
          </Link>
        </div>
      )}

      {cases && cases.length > 0 && (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li key={c.case_id}>
              <CaseCard c={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
