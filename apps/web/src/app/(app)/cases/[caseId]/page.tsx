"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { IconShieldOff, LivePipelineArt } from "@/components/Art";
import { CaseDetailSkeleton } from "@/components/Skeleton";
import BlurredPreview from "@/components/BlurredPreview";
import CaseHeader from "@/components/CaseHeader";
import ScreeningResult from "@/components/ScreeningResult";
import { getReport, isBusy, type Report } from "@/lib/api";
import { failureCopy } from "@/lib/failure";
import { useCase } from "@/lib/useCase";

const STAGES = [
  { key: "fetching", label: "Retrieving the content" },
  { key: "hashing", label: "Fingerprinting the file" },
  { key: "sampling", label: "Taking still frames" },
  { key: "verifying_identity", label: "Confirming this is you" },
  { key: "screening", label: "Running the automated check" },
  { key: "sealing", label: "Sealing the evidence record" },
];

export default function CaseOverviewPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = use(params);
  const { kase, error } = useCase(caseId);
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    if (kase?.status === "complete" && !report) {
      getReport(caseId).then(setReport).catch(() => {});
    }
  }, [kase?.status, caseId, report]);

  if (error) return <Notice title="Could not load this case" body={error} />;
  if (!kase) return <CaseDetailSkeleton />;

  if (kase.status === "failed") {
    const copy = failureCopy(kase);
    return (
      <div className="space-y-6">
        <CaseHeader kase={kase} />
        <section className="tt-card rounded-xl border border-line p-6">
          <h2 className="flex items-center gap-2.5 text-lg font-medium">
            <IconShieldOff className="h-5 w-5 shrink-0 text-attention" />
            {copy.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{copy.body}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            <strong className="font-medium text-ink">You can still report it directly.</strong>{" "}
            Platforms act on your statement that you are the person depicted — not on
            whether TrueTrace's automation succeeded.
          </p>
          {kase.identity_check?.best_similarity != null && (
            <p className="mt-3 text-xs text-subtle">
              Face-match confidence: {(kase.identity_check.best_similarity * 100).toFixed(0)}%
              (a match is accepted from{" "}
              {((kase.identity_check.threshold ?? 0.4) * 100).toFixed(0)}% up — this is a
              deliberately lenient check, biased against wrongly turning away a real match).
            </p>
          )}
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-subtle hover:text-ink">
              Technical detail
            </summary>
            <p className="mt-2 break-all font-mono text-xs text-subtle">
              {kase.error ?? "unknown error"}
            </p>
          </details>
          <Link
            href="/cases/new"
            className="tt-press tt-focus mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition hover:opacity-90"
          >
            {copy.suggestRetryWithNewPhoto ? "Try again with a different photo" : "Try another link"}
          </Link>
        </section>
      </div>
    );
  }

  const busy = isBusy(kase.status);

  return (
    <div className="space-y-8">
      <CaseHeader kase={kase} />

      {busy && <Progress status={kase.status} />}

      {!busy && kase.analysis && <ScreeningResult analysis={kase.analysis} />}

      {!busy && report && (
        <section className="rounded-xl border border-accent/40 bg-accent-soft p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
            Your next step
          </h2>
          <p className="mt-2 text-base text-ink">
            Your report{report.platform ? ` for ${report.platform}` : ""} is ready.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/cases/${caseId}/report`}
              className="tt-press tt-focus rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition hover:opacity-90"
            >
              Open the report
            </Link>
            <Link
              href={`/cases/${caseId}/evidence`}
              className="tt-press tt-focus rounded-lg border border-line bg-surface px-5 py-2.5 text-sm text-ink transition hover:bg-raised"
            >
              View evidence
            </Link>
          </div>
        </section>
      )}

      {!busy && kase.preview_b64 && (
        <BlurredPreview b64={kase.preview_b64} alt="Frame from the reported content" />
      )}

      <section className="tt-card rounded-xl border border-line p-6">
        <h2 className="text-lg font-medium">Case timeline</h2>
        <ol className="mt-4 space-y-3">
          {kase.audit.map((a, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <div>
                <p className="text-ink">{humanAction(a.action)}</p>
                <p className="text-xs text-subtle">
                  {new Date(a.at).toLocaleString()}
                  {a.detail ? ` · ${truncate(a.detail)}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

const ACTIONS: Record<string, string> = {
  created: "Link submitted",
  fetched: "Content retrieved",
  hashed: "File fingerprinted",
  screened: "Analysis completed",
  sealed: "Evidence generated",
  report_drafted: "Report drafted",
  fetch_failed: "Retrieval failed",
  failed: "Case failed",
};

function humanAction(a: string) {
  return ACTIONS[a] ?? a;
}

function truncate(s: string, n = 52) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function Progress({ status }: { status: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const current = STAGES.findIndex((s) => s.key === status);

  return (
    <section className="tt-card rounded-xl border border-line p-6">
      <LivePipelineArt stage={current} className="mb-5 h-auto w-full max-w-sm" />
      <p aria-live="polite" className="text-sm text-ink">
        {STAGES[current]?.label ?? "Getting started"}…
      </p>
      <ol className="mt-5 space-y-3">
        {STAGES.map((s, i) => {
          const state = current > i ? "done" : current === i ? "active" : "todo";
          return (
            <li key={s.key} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                  state === "done"
                    ? "border-accent bg-accent"
                    : state === "active"
                      ? "border-accent"
                      : "border-line"
                }`}
              >
                {state === "done" && (
                  <svg viewBox="0 0 16 16" className="h-3 w-3 text-accent-ink">
                    <path fill="currentColor" d="M6.3 11.3 3.5 8.5l1-1 1.8 1.8 4.2-4.2 1 1z" />
                  </svg>
                )}
                {state === "active" && (
                  <span className="tt-breathe h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </span>
              <span className={state === "todo" ? "text-subtle" : "text-muted"}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-5 text-xs text-subtle">
        {seconds}s elapsed. You can close this page — the work carries on, and the case
        stays in your list.
      </p>
    </section>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <section className="tt-card rounded-xl border border-line p-6">
      <h1 className="text-lg font-medium">{title}</h1>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </section>
  );
}
