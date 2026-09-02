"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  EvidenceArt,
  HeroArt,
  IconCheck,
  IconClock,
  IconIncognito,
  IconLock,
  PipelineArt,
  PlatformMark,
  ReportArt,
  STEP_ICONS,
} from "@/components/Art";
import Reveal from "@/components/Reveal";
import SupportResources from "@/components/SupportResources";
import { createCase, ownerId } from "@/lib/api";

const STEPS = [
  {
    title: "We retrieve it",
    body: "You paste a link. Nothing is uploaded from your device, and you never have to watch it again.",
  },
  {
    title: "We record proof",
    body: "A tamper-evident, encrypted record of what was there and when — before it can be deleted.",
  },
  {
    title: "We draft the report",
    body: "Worded for the platform it is on, citing the policy and the law that apply.",
  },
  {
    title: "You send it",
    body: "You stay in control. Nothing is sent anywhere without you.",
  },
];

const TRUST = [
  { Icon: IconLock, title: "Encrypted evidence", body: "Sealed with AES-256-GCM. Any later change to it is detectable." },
  { Icon: IconIncognito, title: "No account, ever", body: "Pseudonymous by default. No email, no profile, no sign-up." },
  { Icon: IconClock, title: "48-hour legal deadline", body: "US reports cite the TAKE IT DOWN Act, which platforms must meet." },
];

const PLATFORMS = [
  { name: "YouTube", detail: "NCII removal + privacy complaint routes" },
  { name: "Meta", detail: "Facebook, Instagram, Threads + StopNCII" },
  { name: "X", detail: "Non-consensual nudity + statutory route" },
  { name: "TikTok", detail: "Privacy webform + StopNCII" },
];

export default function SubmitPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [isIntimate, setIsIntimate] = useState(true);
  const [depicts, setDepicts] = useState(true);
  const [jurisdiction, setJurisdiction] = useState("US");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = url.trim();
  const looksLikeUrl = /^https?:\/\/.+\..+/i.test(trimmed);
  const showUrlHint = trimmed.length > 0 && !looksLikeUrl;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { case_id } = await createCase({
        url: trimmed,
        depicts_reporter: depicts,
        consent_given: false,
        is_intimate: isIntimate,
        jurisdiction,
        reporter_name: null,
        reporter_contact: null,
        extra_context: context.trim() || null,
        owner: ownerId(),
      });
      router.push(`/case?id=${case_id}`);
    } catch {
      setError(
        "We could not reach the TrueTrace service. Your link has not been sent anywhere. Please check your connection and try again.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="space-y-12">
      <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="tt-rise text-3xl font-semibold tracking-tight sm:text-4xl">
            Someone made a video of you.{" "}
            <span className="text-accent">Let&apos;s deal with it.</span>
          </h1>
          <p className="tt-rise tt-d1 mt-4 max-w-xl text-base leading-relaxed text-muted">
            TrueTrace records proof that the content existed, then writes the takedown
            report for the platform it is on — worded the way that platform needs.
          </p>
          <ul className="tt-rise tt-d2 mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <Assurance>No account or email</Assurance>
            <Assurance>Nothing to upload</Assurance>
            <Assurance>You never have to re-watch it</Assurance>
          </ul>
        </div>
        {/* Shown at every size: a phone is the most likely context for this
            product, so mobile should not be the one that loses the warmth. */}
        <HeroArt className="tt-fade tt-d2 order-first mx-auto h-auto w-full max-w-xs sm:max-w-sm lg:order-last lg:max-w-none" />
      </section>

      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-xs font-semibold uppercase tracking-wide text-muted">
          What happens after you paste the link
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <li
                key={s.title}
                className={`tt-card tt-lift tt-rise tt-d${i + 1} rounded-xl border border-line p-4`}
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-sm font-medium text-ink">
                  <span className="mr-1.5 font-mono text-xs text-subtle">{i + 1}</span>
                  {s.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{s.body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <Reveal>
        <section aria-labelledby="pipeline-heading" className="tt-halo">
          <h2 id="pipeline-heading" className="text-xs font-semibold uppercase tracking-wide text-muted">
            What happens to the video
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Sixteen still frames are sampled, the file is fingerprinted, and the whole
            record is sealed. The video itself is deleted and never uploaded anywhere.
          </p>
          <PipelineArt className="mt-4 h-auto w-full" />
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="output-heading">
          <h2 id="output-heading" className="text-xs font-semibold uppercase tracking-wide text-muted">
            What you end up with
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <article className="tt-card tt-lift flex gap-4 rounded-xl border border-line p-5">
              <EvidenceArt className="h-20 w-20 shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-ink">An evidence record</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Encrypted, timestamped, with a fingerprint of every frame examined.
                  It proves what was there even after the content is taken down.
                </p>
              </div>
            </article>
            <article className="tt-card tt-lift flex gap-4 rounded-xl border border-line p-5">
              <ReportArt className="h-20 w-20 shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-ink">A report ready to send</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Written for the platform it is on, citing the policy and the law that
                  apply, with a link straight to the right reporting form.
                </p>
              </div>
            </article>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="platforms-heading">
          <h2 id="platforms-heading" className="text-xs font-semibold uppercase tracking-wide text-muted">
            Reporting routes we know
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PLATFORMS.map((pf) => (
              <li key={pf.name} className="tt-card tt-lift rounded-xl border border-line p-4">
                <PlatformMark className="h-6 w-6 text-accent" />
                <h3 className="mt-2 text-sm font-medium text-ink">{pf.name}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{pf.detail}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-subtle">
            Every route was checked against the platform&apos;s own help centre. Anywhere
            else gets a generic report you can send to the site&apos;s abuse contact.
          </p>
        </section>
      </Reveal>

      <Reveal>
        <ul className="grid gap-4 sm:grid-cols-3">
          {TRUST.map(({ Icon, title, body }) => (
            <li key={title} className="tt-card rounded-xl border border-line p-5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-medium text-ink">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </Reveal>

      <form onSubmit={submit} className="space-y-6" noValidate>
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-ink">
            Link to the content
          </label>
          <input
            id="url"
            name="url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            aria-describedby="url-help"
            className="mt-2 w-full rounded-lg border border-line bg-raised px-3 py-3 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <p id="url-help" className="mt-1.5 text-xs text-subtle">
            {showUrlHint
              ? "That does not look like a web address yet — it should start with https://"
              : "The video is retrieved, fingerprinted, then deleted. It is never stored or uploaded anywhere."}
          </p>
        </div>

        <fieldset className="tt-card space-y-4 rounded-xl border border-line p-5">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            A few questions, so the report is right
          </legend>

          <Check
            id="depicts"
            checked={depicts}
            onChange={setDepicts}
            label="This content shows me"
            hint="Platforms act fastest on reports from the person depicted."
          />
          <Check
            id="intimate"
            checked={isIntimate}
            onChange={setIsIntimate}
            label="It is intimate or sexual"
            hint="In the US this triggers a legal 48-hour removal deadline, so we cite it in the report."
          />

          <div className="pt-1">
            <label htmlFor="j" className="block text-sm text-ink">
              Where are you?
            </label>
            <select
              id="j"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="mt-1.5 rounded-md border border-line bg-raised px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="US">United States</option>
              <option value="OTHER">Somewhere else</option>
            </select>
            <p className="mt-1 text-xs text-subtle">
              This only changes which laws the report can cite.
            </p>
          </div>
        </fieldset>

        <details className="tt-card rounded-xl border border-line">
          <summary className="cursor-pointer px-5 py-3 text-sm text-muted hover:text-ink">
            Add context for the platform{" "}
            <span className="text-subtle">(optional)</span>
          </summary>
          <div className="px-5 pb-5">
            <textarea
              id="ctx"
              rows={3}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Anything that helps them understand the situation."
              className="w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <p className="mt-1 text-xs text-subtle">
              This goes into the draft. You can edit or delete it before sending.
            </p>
          </div>
        </details>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-attention-line bg-attention-bg px-4 py-3 text-sm text-attention"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={busy || !looksLikeUrl}
            className="rounded-lg bg-accent px-6 py-3 shadow-lg shadow-accent/20 text-sm font-medium text-accent-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Starting…" : "Start documenting"}
          </button>
          <span className="text-xs text-subtle">
            Usually takes under a minute. Nothing is sent to any platform.
          </span>
        </div>
      </form>

      <SupportResources />
    </div>
  );
}

function Assurance({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <IconCheck className="h-4 w-4 text-accent" />
      {children}
    </li>
  );
}

function Check({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={`${id}-hint`}
        className="mt-1 h-4 w-4 shrink-0 accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      <div>
        <label htmlFor={id} className="block cursor-pointer text-sm text-ink">
          {label}
        </label>
        <span id={`${id}-hint`} className="block text-xs text-subtle">
          {hint}
        </span>
      </div>
    </div>
  );
}
