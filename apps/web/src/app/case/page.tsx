"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import BlurredPreview from "@/components/BlurredPreview";
import ScreeningResult from "@/components/ScreeningResult";
import { getCase, getReport, type Case, type Report } from "@/lib/api";

const STAGE_COPY: Record<string, string> = {
  queued: "Queued",
  fetching: "Retrieving the content",
  hashing: "Recording a fingerprint of the file",
  sampling: "Taking still frames",
  screening: "Running the automated check",
  sealing: "Sealing the evidence record",
};

/**
 * The case id travels as a query parameter rather than a path segment.
 *
 * A dynamic route (/case/[id]) cannot be statically exported without
 * generateStaticParams, and case ids are created at runtime - so a path segment
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
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
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
      if (status !== "complete" && status !== "failed") {
        timer = setTimeout(tick, 1500);
      }
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

  if (!id) return <Notice title="No case selected" body="This link is missing a case reference." />;
  if (error) return <Notice title="Could not load this case" body={error} />;
  if (!kase) return <Notice title="Loading…" body="Fetching the case." />;

  if (kase.status === "failed") {
    return (
      <div className="space-y-6">
        <Notice
          title="We could not retrieve that content"
          body={
            kase.error ??
            "The link may be private, removed, or on a site we cannot reach automatically."
          }
        />
        <p className="text-sm text-slate-400">
          You can still file a report. Platforms act on your statement that you are
          depicted, not on our retrieval succeeding.
        </p>
      </div>
    );
  }

  const done = kase.status === "complete";

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs text-slate-500">{kase.case_id}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {done ? "Your evidence is recorded" : "Working on it"}
        </h1>
        <p className="mt-2 break-all text-xs text-slate-500">{kase.source_url}</p>
      </div>

      {!done && <Progress status={kase.status} />}

      {done && kase.analysis && <ScreeningResult analysis={kase.analysis} />}

      {done && kase.preview_b64 && (
        <BlurredPreview b64={kase.preview_b64} alt="Frame from the reported content" />
      )}

      {done && kase.evidence && (
        <section className="rounded-xl border border-slate-800 p-6">
          <h2 className="text-lg font-medium">Evidence record</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Encrypted and sealed. Every frame carries its own fingerprint, so any later
            alteration is detectable. Keep the reference below — it proves what was
            examined and when.
          </p>
          <dl className="mt-4 space-y-3 text-xs">
            <Row label="Content fingerprint (SHA-256)" value={kase.evidence.video_sha256} mono />
            <Row label="Evidence manifest" value={kase.evidence.manifest_sha256} mono />
            <Row label="Recorded" value={new Date(kase.evidence.fetched_at).toLocaleString()} />
            <Row label="Frames sealed" value={String(kase.evidence.frame_count)} />
            <Row label="Expires" value={new Date(kase.evidence.expires_at).toLocaleString()} />
          </dl>
        </section>
      )}

      {report && (
        <section className="rounded-xl border border-slate-800 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-medium">
              Takedown report{report.platform ? ` for ${report.platform}` : ""}
            </h2>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(report.body);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              {copied ? "Copied" : "Copy report"}
            </button>
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

          <p className="mt-4 text-xs text-slate-500">Subject: {report.subject}</p>
          <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-xs leading-relaxed text-slate-300">
            {report.body}
          </pre>

          <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Where to send it
          </h3>
          <ul className="mt-2 space-y-2">
            {report.routes.map((r) => (
              <li key={r.url} className="text-sm">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-slate-200 underline underline-offset-2 hover:text-white"
                >
                  {r.name}
                </a>
                {r.note && <span className="block text-xs text-slate-500">{r.note}</span>}
              </li>
            ))}
          </ul>

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
        </section>
      )}
    </div>
  );
}

function Progress({ status }: { status: string }) {
  const stages = ["fetching", "hashing", "sampling", "screening", "sealing"];
  const current = stages.indexOf(status);
  return (
    <section className="rounded-xl border border-slate-800 p-6">
      <p className="text-sm text-slate-300">{STAGE_COPY[status] ?? status}…</p>
      <ol className="mt-4 space-y-2">
        {stages.map((s, i) => (
          <li key={s} className="flex items-center gap-3 text-sm">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                current > i ? "bg-slate-300" : current === i ? "bg-amber-300" : "bg-slate-700"
              }`}
            />
            <span className={current >= i ? "text-slate-300" : "text-slate-600"}>
              {STAGE_COPY[s]}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`mt-0.5 break-all text-slate-300 ${mono ? "font-mono" : ""}`}>{value}</dd>
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
