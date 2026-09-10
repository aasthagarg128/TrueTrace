"use client";

import { use, useEffect, useState } from "react";
import CaseHeader from "@/components/CaseHeader";
import { CaseDetailSkeleton } from "@/components/Skeleton";
import { getReport, shortRef, type Report } from "@/lib/api";
import { useCase } from "@/lib/useCase";

export default function ReportPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = use(params);
  const { kase, error } = useCase(caseId);
  const [report, setReport] = useState<Report | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (kase?.status === "complete" && !report) {
      getReport(caseId)
        .then(setReport)
        .catch((e) => setReportError(e instanceof Error ? e.message : String(e)));
    }
  }, [kase?.status, caseId, report]);

  if (error) return <Notice title="Could not load this case" body={error} />;
  if (!kase) return <CaseDetailSkeleton />;

  function download() {
    if (!report) return;
    const blob = new Blob([`Subject: ${report.subject}\n\n${report.body}`], {
      type: "text/plain;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `truetrace-${shortRef(caseId)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-8">
      <CaseHeader kase={kase} />

      {kase.status !== "complete" && (
        <Notice
          title="The report is not ready yet"
          body={
            kase.status === "failed"
              ? "The content could not be retrieved. You can still report it — platforms act on your statement that you are depicted."
              : "Analysis is still running. The draft appears here as soon as it finishes."
          }
        />
      )}

      {reportError && <Notice title="Could not draft the report" body={reportError} />}

      {report && (
        <>
          {report.warnings.length > 0 && (
            <ul className="space-y-2">
              {report.warnings.map((w, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-attention-line bg-attention-bg px-4 py-3 text-sm text-attention"
                >
                  {w}
                </li>
              ))}
            </ul>
          )}

          <section className="rounded-xl border border-accent/40 bg-accent-soft p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
              Send it here
            </h2>
            <p className="mt-2 text-base text-ink">
              Copy the report below, then open{" "}
              {report.platform ? `${report.platform}'s reporting form` : "the site's abuse contact"}.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {report.routes[0] && (
                <a
                  href={report.routes[0].url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="tt-press tt-focus rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition hover:opacity-90"
                >
                  Open {report.routes[0].name} ↗
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(report.body);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="tt-press tt-focus rounded-lg border border-line bg-surface px-5 py-2.5 text-sm text-ink transition hover:bg-raised"
              >
                {copied ? "Copied ✓" : "Copy report"}
              </button>
              <button
                type="button"
                onClick={download}
                className="tt-press tt-focus rounded-lg border border-line bg-surface px-5 py-2.5 text-sm text-ink transition hover:bg-raised"
              >
                Download
              </button>
            </div>
          </section>

          <section className="tt-card rounded-xl border border-line p-6">
            <h2 className="text-lg font-medium">
              Draft{report.platform ? ` for ${report.platform}` : ""}
            </h2>
            <p className="mt-4 text-xs text-subtle">Subject</p>
            <p className="text-sm text-muted">{report.subject}</p>
            <p className="mt-4 text-xs text-subtle">Message</p>
            <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-raised p-4 text-xs leading-relaxed text-muted">
              {report.body}
            </pre>
            <p className="mt-2 text-xs text-subtle">
              Edit anything before you send it. It is your report.
            </p>
          </section>

          <section className="tt-card rounded-xl border border-line p-6">
            <h2 className="text-lg font-medium">Before you send</h2>
            <ul className="mt-3 space-y-1.5">
              {report.checklist.map((c, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted">
                  <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>

            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-subtle">
              All reporting routes
            </h3>
            <ul className="mt-2 space-y-2">
              {report.routes.map((r) => (
                <li key={r.url} className="text-sm">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent underline underline-offset-2 hover:opacity-80"
                  >
                    {r.name} ↗
                  </a>
                  {r.note && <span className="block text-xs text-subtle">{r.note}</span>}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <section className="tt-card rounded-xl border border-line p-6">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </section>
  );
}
