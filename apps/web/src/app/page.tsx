"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCase, ownerId } from "@/lib/api";

export default function SubmitPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [isIntimate, setIsIntimate] = useState(true);
  const [depicts, setDepicts] = useState(true);
  const [jurisdiction, setJurisdiction] = useState("US");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { case_id } = await createCase({
        url: url.trim(),
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Document it, then report it
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
          Paste the link to the content. TrueTrace retrieves it, records a
          tamper-evident copy of the evidence, and drafts the takedown report for the
          platform it is on.
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          You do not upload anything and you do not have to watch it again. No account,
          no email.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-slate-200">
            Link to the content
          </label>
          <input
            id="url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            The video is retrieved, hashed, and deleted. It is never stored or uploaded.
          </p>
        </div>

        <fieldset className="space-y-3 rounded-lg border border-slate-800 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            About the content
          </legend>

          <Check
            checked={depicts}
            onChange={setDepicts}
            label="This content depicts me"
            hint="Reports are strongest when filed by the person depicted."
          />
          <Check
            checked={isIntimate}
            onChange={setIsIntimate}
            label="The content is intimate or sexual"
            hint="Unlocks faster statutory routes, including the 48-hour TAKE IT DOWN Act requirement in the US."
          />

          <div className="pt-1">
            <label htmlFor="j" className="block text-sm text-slate-200">
              Where are you located?
            </label>
            <select
              id="j"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="mt-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
            >
              <option value="US">United States</option>
              <option value="OTHER">Elsewhere</option>
            </select>
          </div>
        </fieldset>

        <div>
          <label htmlFor="ctx" className="block text-sm font-medium text-slate-200">
            Anything else the platform should know{" "}
            <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id="ctx"
            rows={3}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Starting…" : "Document this"}
        </button>
      </form>
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-slate-300"
      />
      <span>
        <span className="block text-sm text-slate-200">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );
}
