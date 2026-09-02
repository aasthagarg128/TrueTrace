"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconLock } from "@/components/Art";
import { createCase } from "@/lib/api";

/**
 * Case creation lives here, behind authentication — not on the public landing
 * page. Pasting a link is the first step of a sensitive workflow, and it should
 * happen inside the private workspace, attached to an account that owns it.
 */
export default function NewCasePage() {
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
      });
      router.push(`/cases/${case_id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not start the case. Your link has not been sent anywhere.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <Link href="/cases" className="text-sm text-muted hover:text-ink">
          ← My cases
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New case</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          You only need the link. You don&apos;t need to download or upload the video,
          and you don&apos;t need to watch it again.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-6" noValidate>
        <div className="tt-card rounded-xl border border-line p-6">
          <label htmlFor="url" className="block text-sm font-medium text-ink">
            Video URL
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
            placeholder="https://"
            aria-describedby="url-help"
            className="mt-2 w-full rounded-lg border border-line bg-raised px-3 py-3 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <p id="url-help" className="mt-1.5 text-xs text-subtle">
            {trimmed && !looksLikeUrl
              ? "That does not look like a web address yet — it should start with https://"
              : "The video is retrieved, fingerprinted, then deleted. It is never stored or uploaded anywhere."}
          </p>
        </div>

        <fieldset className="tt-card space-y-4 rounded-xl border border-line p-6">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-subtle">
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
            hint="In the US this triggers a legal 48-hour removal deadline, which we cite in the report."
          />
          <div className="pt-1">
            <label htmlFor="j" className="block text-sm text-ink">Where are you?</label>
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
          <summary className="cursor-pointer px-6 py-4 text-sm text-muted hover:text-ink">
            Add context for the platform <span className="text-subtle">(optional)</span>
          </summary>
          <div className="px-6 pb-6">
            <textarea
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
          <p role="alert" className="rounded-lg border border-attention-line bg-attention-bg px-4 py-3 text-sm text-attention">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={busy || !looksLikeUrl}
            className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-accent-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Starting…" : "Continue"}
          </button>
          <span className="flex items-center gap-1.5 text-xs text-subtle">
            <IconLock className="h-4 w-4 text-accent" />
            Your case is private and pseudonymous.
          </span>
        </div>
      </form>
    </div>
  );
}

function Check({
  id, checked, onChange, label, hint,
}: {
  id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint: string;
}) {
  return (
    <div className="flex gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={`${id}-hint`}
        className="mt-1 h-4 w-4 shrink-0 accent-accent"
      />
      <div>
        <label htmlFor={id} className="block cursor-pointer text-sm text-ink">{label}</label>
        <span id={`${id}-hint`} className="block text-xs text-subtle">{hint}</span>
      </div>
    </div>
  );
}
