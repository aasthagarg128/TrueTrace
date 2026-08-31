"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">
          Someone made a video of you. Let&apos;s deal with it.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          TrueTrace records proof that the content existed, then writes the takedown
          report for the platform it is on — worded the way that platform needs.
        </p>
        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <Assurance>No account or email</Assurance>
          <Assurance>Nothing to upload</Assurance>
          <Assurance>You never have to re-watch it</Assurance>
        </ul>
      </section>

      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-xs font-semibold uppercase tracking-wide text-muted">
          What happens after you paste the link
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-lg border border-line bg-surface p-4">
              <span className="text-xs font-mono text-subtle">{i + 1}</span>
              <h3 className="mt-1 text-sm font-medium text-ink">{s.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

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

        <fieldset className="space-y-4 rounded-lg border border-line p-5">
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

        <details className="rounded-lg border border-line">
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
            className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-accent-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-40"
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
      <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 text-subtle">
        <path
          fill="currentColor"
          d="M6.3 11.3 3.5 8.5l1-1 1.8 1.8 4.2-4.2 1 1z"
        />
      </svg>
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
