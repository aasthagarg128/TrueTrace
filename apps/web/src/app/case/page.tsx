"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import BlurredPreview from "@/components/BlurredPreview";
import ScreeningResult from "@/components/ScreeningResult";
import SupportResources from "@/components/SupportResources";
import { getCase, getReport, type Case, type Report } from "@/lib/api";

const STAGES = [
  { key: "fetching", label: "Retrieving the content" },
  { key: "hashing", label: "Fingerprinting the file" },
  { key: "sampling", label: "Taking still frames" },
  { key: "screening", label: "Running the automated check" },
  { key: "sealing", label: "Sealing the evidence record" },
];

/**
 * The case id travels as a query parameter rather than a path segment.
 *
 * A dynamic route (/case/[id]) cannot be statically exported without
 * generateStaticParams, and case ids are created at runtime — so a path segment
 * would force server rendering and a paid hosting tier. A query parameter keeps
 * this page fully static and deployable on the free tier.
 */
export default function CasePageRoute() {
  return (
    <Suspense fallback={<Notice title="Loading…" body="Fetching the case." />}>
      <CasePage />
    </Suspense>
  );
}

function CasePage() {
  const search = useSearchParams();
  const id = search.get("id") ?? "";
  const [kase, setCase] = useState<Case | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return "failed";
    try {
      const c = await getCase(id);
      setCase(c);
      return c.status;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return "failed";
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    // Polling rather than websockets: identical behaviour locally and deployed,
    // and one less moving part to fail during a demo.
    const tick = async () => {
      const status = await load();
      if (!alive) return;
      if (status !== "complete" && status !== "failed") timer = setTimeout(tick, 1500);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [load]);

  useEffect(() => {
    if (kase?.status === "complete" && !report) {
      getReport(id).then(setReport).catch(() => {});
    }
  }, [kase?.status, id, report]);

  if (!id)
    return <Notice title="No case selected" body="This link is missing a case reference." />;
  if (error) return <Notice title="Could not load this case" body={error} />;
  if (!kase) return <Notice title="Loading…" body="Fetching the case." />;

  if (kase.status === "failed") return <FailedCase kase={kase} />;

  const done = kase.status === "complete";

  return (
    <div className="space-y-8">
      <header>
        <p className="font-mono text-xs text-slate-500">{kase.case_id}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {done ? "Your evidence is recorded" : "Working on it"}
        </h1>
        {done && (
          <p className="mt-2 text-sm text-slate-400">
            The proof is sealed. Below is a report you can send, ready to go.
          </p>
        )}
        <p className="mt-2 break-all text-xs text-slate-600">{kase.source_url}</p>
      </header>

      {!done && <Progress status={kase.status} />}

      {done && report && <NextStep report={report} />}
      {done && kase.analysis && <ScreeningResult analysis={kase.analysis} />}
      {done && kase.preview_b64 && (
        <BlurredPreview b64={kase.preview_b64} alt="Frame from the reported content" />
      )}
      {done && kase.evidence && <EvidenceCard kase={kase} />}
      {report && <ReportCard report={report} caseId={kase.case_id} />}

      <SupportResources compact />
    </div>
  );
}

/** The single most useful thing on the page once analysis finishes: where to go now. */
function NextStep({ report }: { report: Report }) {
  const primary = report.routes[0];
  if (!primary) return null;
  return (
    <section className="rounded-xl border border-slate-100/20 bg-slate-100/5 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Your next step
      </h2>
      <p className="mt-2 text-base text-slate-200">
        Copy the report below, then open{" "}
        {report.platform ? `${report.platform}'s reporting form` : "the site's abuse contact"}.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={primary.url}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Open {primary.name} ↗
        </a>
        <a
          href="#report"
          className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
        >
          Read the draft first
        </a>
      </div>
      {report.warnings.length > 0 && (
        <ul className="mt-4 space-y-2">
          {report.warnings.map((w, i) => (
            <li
              key={i}
              className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-sm text-amber-200"
            >
              {w}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Progress({ status }: { status: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const current = STAGES.findIndex((s) => s.key === status);
  const label = STAGES[current]?.label ?? "Getting started";

  return (
    <section className="rounded-xl border border-slate-800 p-6">
      {/* aria-live so a screen reader announces stage changes without a refocus. */}
      <p aria-live="polite" className="text-sm text-slate-200">
        {label}…
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
                    ? "border-slate-300 bg-slate-300"
                    : state === "active"
                      ? "border-amber-300"
                      : "border-slate-700"
                }`}
              >
                {state === "done" && (
                  <svg viewBox="0 0 16 16" className="h-3 w-3 text-slate-900">
                    <path fill="currentColor" d="M6.3 11.3 3.5 8.5l1-1 1.8 1.8 4.2-4.2 1 1z" />
                  </svg>
                )}
                {state === "active" && (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300 motion-reduce:animate-none" />
                )}
              </span>
              <span className={state === "todo" ? "text-slate-600" : "text-slate-300"}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-5 text-xs text-slate-500">
        {seconds}s elapsed. You can close this page — the work carries on, and your
        link brings you back.
      </p>
    </section>
  );
}

function EvidenceCard({ kase }: { kase: Case }) {
  const ev = kase.evidence!;
  return (
    <section className="rounded-xl border border-slate-800 p-6">
      <h2 className="text-lg font-medium">Evidence record</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
        Encrypted and sealed. Every frame carries its own fingerprint, so any later
        alteration is detectable. This matters because content often disappears once
        it is reported — this proves what was there.
      </p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Row label="Content fingerprint" value={ev.video_sha256} mono />
        <Row label="Evidence manifest" value={ev.manifest_sha256} mono />
        <Row label="Recorded" value={new Date(ev.fetched_at).toLocaleString()} />
        <Row label="Frames sealed" value={String(ev.frame_count)} />
        <Row label="Expires" value={new Date(ev.expires_at).toLocaleString()} />
        <Row label="Size" value={`${Math.round(ev.size_bytes / 1024)} KB`} />
      </dl>
    </section>
  );
}

function ReportCard({ report, caseId }: { report: Report; caseId: string }) {
  const [copied, setCopied] = useState(false);

  function download() {
    const blob = new Blob([`Subject: ${report.subject}\n\n${report.body}`], {
      type: "text/plain;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `truetrace-${caseId}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section id="report" className="scroll-mt-6 rounded-xl border border-slate-800 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">
          Your report{report.platform ? ` for ${report.platform}` : ""}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(report.body);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {copied ? "Copied ✓" : "Copy report"}
          </button>
          <button
            type="button"
            onClick={download}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Download
          </button>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">Subject</p>
      <p className="text-sm text-slate-300">{report.subject}</p>

      <p className="mt-4 text-xs text-slate-500">Message</p>
      <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-xs leading-relaxed text-slate-300">
        {report.body}
      </pre>
      <p className="mt-2 text-xs text-slate-500">
        Edit anything before you send it. It is your report.
      </p>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Before you send
      </h3>
      <ul className="mt-2 space-y-1.5">
        {report.checklist.map((c, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-300">
            <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-600" />
            <span>{c}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
        All reporting routes
      </h3>
      <ul className="mt-2 space-y-2">
        {report.routes.map((r) => (
          <li key={r.url} className="text-sm">
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-slate-200 underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {r.name} ↗
            </a>
            {r.note && <span className="block text-xs text-slate-500">{r.note}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FailedCase({ kase }: { kase: Case }) {
  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-xs text-slate-500">{kase.case_id}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          We could not retrieve that content
        </h1>
      </header>
      <section className="rounded-xl border border-slate-800 p-6">
        <p className="text-sm leading-relaxed text-slate-300">
          The link may be private, already removed, behind a login, or on a site we
          cannot reach automatically. This is common and it is not your fault.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          <strong className="font-medium text-slate-100">
            You can still report it.
          </strong>{" "}
          Platforms act on your statement that you are the person depicted — not on
          whether our retrieval worked.
        </p>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">
            Technical detail
          </summary>
          <p className="mt-2 break-all font-mono text-xs text-slate-500">
            {kase.error ?? "unknown error"}
          </p>
        </details>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-white"
          >
            Try another link
          </Link>
        </div>
      </section>
      <SupportResources />
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 break-all text-xs text-slate-300 ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-xl border border-slate-800 p-6">
      <h1 className="text-lg font-medium">{title}</h1>
      <p className="mt-2 text-sm text-slate-400">{body}</p>
    </section>
  );
}
