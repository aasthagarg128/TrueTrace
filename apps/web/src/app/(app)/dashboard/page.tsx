"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import CaseCard from "@/components/CaseCard";
import FeedbackForm from "@/components/FeedbackForm";
import { EmptyCasesArt, IconDraft, IconLink, IconSeal } from "@/components/Art";
import { CaseListSkeleton, StatSkeleton } from "@/components/Skeleton";
import { listCases, isBusy, type CaseSummary } from "@/lib/api";

/**
 * The dashboard repeats none of the landing page's marketing. Someone who has
 * signed in has already been convinced; they want their cases.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCases()
      .then(setCases)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const active = cases?.filter((c) => isBusy(c.status)).length ?? 0;
  const ready = cases?.filter((c) => c.status === "complete").length ?? 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Good to see you.</h1>
          <p className="mt-1 text-sm text-muted">
            Signed in as <span className="text-ink">{user?.username}</span>
          </p>
        </div>
        <Link
          href="/cases/new"
          className="tt-press tt-focus rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition hover:opacity-90"
        >
          + New case
        </Link>
      </header>

      <section aria-labelledby="overview">
        <h2 id="overview" className="sr-only">Overview</h2>
        {cases === null ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </div>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-3">
            <Stat label="In progress" value={active} Icon={IconLink} live={active > 0} />
            <Stat label="Reports ready" value={ready} Icon={IconDraft} />
            <Stat label="Monitoring" value="—" Icon={IconSeal} note="Not available yet" />
          </dl>
        )}
      </section>

      <section aria-labelledby="recent">
        <div className="flex items-baseline justify-between">
          <h2 id="recent" className="text-lg font-medium">Recent cases</h2>
          {cases && cases.length > 3 && (
            <Link href="/cases" className="text-sm text-accent underline underline-offset-2">
              View all
            </Link>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-attention-line bg-attention-bg px-4 py-3 text-sm text-attention">
            {error}
          </p>
        )}

        {cases === null && !error && (
          <div className="mt-4">
            <CaseListSkeleton rows={2} />
          </div>
        )}

        {cases?.length === 0 && (
          <div className="tt-card tt-rise mt-4 rounded-xl border border-line p-8 text-center">
            <EmptyCasesArt className="mx-auto h-28 w-auto" />
            <p className="mt-4 text-sm text-muted">
              You have no cases yet. When you find something, start here.
            </p>
            <Link
              href="/cases/new"
              className="tt-press tt-focus mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition hover:opacity-90"
            >
              Start a case
            </Link>
          </div>
        )}

        {cases && cases.length > 0 && (
          <ul className="mt-4 space-y-3">
            {cases.slice(0, 3).map((c) => (
              <li key={c.case_id}>
                <CaseCard c={c} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="tt-card group rounded-xl border border-line">
        <summary className="cursor-pointer px-6 py-4 text-sm text-muted hover:text-ink">
          Something wrong, or missing? <span className="text-subtle">Send feedback</span>
        </summary>
        <div className="px-6 pb-6">
          <FeedbackForm page="dashboard" />
        </div>
      </details>
    </div>
  );
}

function Stat({
  label,
  value,
  Icon,
  note,
  live = false,
}: {
  label: string;
  value: number | string;
  Icon: (p: { className?: string }) => React.ReactElement;
  note?: string;
  /** Something is genuinely running right now — worth a pulse, not decoration. */
  live?: boolean;
}) {
  return (
    <div className="tt-card tt-lift rounded-xl border border-line p-5">
      <div className="flex items-center justify-between">
        <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-subtle">
          {live && <span className="tt-dot tt-dot-live text-accent" aria-hidden />}
          {label}
        </dt>
        <Icon className="h-4.5 w-4.5 text-accent" />
      </div>
      <dd className="tt-pop mt-2 text-3xl font-semibold tabular-nums text-ink">{value}</dd>
      {note && <p className="mt-1 text-xs text-subtle">{note}</p>}
    </div>
  );
}
