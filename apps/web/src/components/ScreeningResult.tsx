import type { Analysis } from "@/lib/api";

/**
 * The ONLY component permitted to render a screening result.
 *
 * The band and its limitations are rendered together, in one component, on
 * purpose: there is no way to display the outcome on some screen while
 * forgetting the caveats. The plain-language reading comes first and the
 * technical detail is subordinate to it, because the number is the part users
 * are most likely to over-read.
 */

const COPY: Record<
  Analysis["band"],
  { heading: string; lead: string; tone: string; accent: string }
> = {
  flagged: {
    heading: "The screening flagged this content",
    lead: "An automated check found signs it associates with manipulated video. This is a prompt to look closer — it is not a finding that the video is fake.",
    tone: "border-amber-400/30 bg-amber-400/5",
    accent: "text-amber-300",
  },
  not_flagged: {
    heading: "The screening did not flag this content",
    lead: "This does not mean the video is authentic. The check misses a large share of manipulated videos, so it cannot clear anything.",
    tone: "border-slate-400/20 bg-slate-400/5",
    accent: "text-slate-300",
  },
  inconclusive: {
    heading: "The screening could not reach a result",
    lead: "There were too few usable frames showing a face. Nothing should be concluded from this in either direction.",
    tone: "border-slate-400/20 bg-slate-400/5",
    accent: "text-slate-300",
  },
};

export default function ScreeningResult({ analysis }: { analysis: Analysis }) {
  const copy = COPY[analysis.band];

  return (
    <section className={`rounded-xl border p-6 ${copy.tone}`}>
      <h2 className={`text-lg font-medium ${copy.accent}`}>{copy.heading}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">{copy.lead}</p>

      <div className="mt-5 rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          What this tool can and cannot tell you
        </h3>
        <ul className="mt-2 space-y-2">
          {analysis.limitations.map((l, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-300">
              <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-500" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      </div>

      <details className="mt-4 group">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-300">
          Technical detail
        </summary>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
          <Detail label="Frames examined" value={`${analysis.frames_scored} of ${analysis.frames_submitted}`} />
          <Detail label="Frames with a face" value={String(analysis.frames_with_face)} />
          <Detail
            label="Peak frame value"
            value={analysis.score === null ? "not reported" : analysis.score.toFixed(3)}
          />
          <Detail
            label="Frame disagreement"
            value={analysis.dispersion === null ? "n/a" : analysis.dispersion.toFixed(3)}
          />
          <Detail label="Time taken" value={`${(analysis.elapsed_ms / 1000).toFixed(1)}s`} />
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-slate-500">Model</dt>
            <dd className="mt-0.5 break-all font-mono text-[11px] text-slate-400">
              {analysis.model_version}
            </dd>
          </div>
        </dl>
      </details>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-mono text-slate-300">{value}</dd>
    </div>
  );
}
