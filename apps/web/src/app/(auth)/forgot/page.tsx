"use client";

import Link from "next/link";
import { useState } from "react";
import { IconIncognito } from "@/components/Art";
import { forgotPassword } from "@/lib/api";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset link.");
    } finally {
      setBusy(false);
    }
  }

  // The confirmation is deliberately identical whether or not the address has an
  // account. Saying "no account found" would turn this page into a way to check
  // whether a particular person uses TrueTrace.
  if (sent) {
    return (
      <div className="tt-card tt-rise rounded-2xl border border-line p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          If <span className="text-ink">{email.trim()}</span> has an account, a reset
          link is on its way. It works once and expires in 30 minutes.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Nothing has changed yet. Your current password still works until you use the
          link.
        </p>
        <Link
          href="/login"
          className="tt-press tt-focus mt-6 inline-block rounded-lg border border-line px-5 py-2.5 text-sm text-ink transition hover:bg-raised"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="tt-card rounded-2xl border border-line p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1.5 text-sm text-muted">
        Enter the email address on your account.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="tt-focus mt-2 w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-attention-line bg-attention-bg px-4 py-3 text-sm text-attention"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="tt-press tt-focus w-full rounded-lg bg-accent px-5 py-3 text-sm font-medium text-accent-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="text-accent underline underline-offset-2 hover:opacity-80">
          Back to sign in
        </Link>
      </p>

      <p className="mt-6 flex items-start gap-2 rounded-lg bg-raised px-3 py-2.5 text-xs leading-relaxed text-muted">
        <IconIncognito className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>
          Accounts created without an email address cannot be reset here — there is no
          address to send to. That is the trade-off of the most private option.
        </span>
      </p>
    </div>
  );
}
