"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { IconIncognito, IconShieldOff } from "@/components/Art";
import { deleteAccount } from "@/lib/api";

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted">
          There is very little here, by design.
        </p>
      </header>

      <section className="tt-card rounded-xl border border-line p-6">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent">
            <IconIncognito className="h-5 w-5" />
          </span>
          What we hold about you
        </h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div>
            <dt className="text-xs text-subtle">Username</dt>
            <dd className="mt-0.5 text-ink">{user?.username}</dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">Account created</dt>
            <dd className="mt-0.5 text-muted">
              {user ? new Date(user.created_at).toLocaleString() : "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-5 text-sm leading-relaxed text-muted">
          That is the complete list. No email address, no phone number, no real name, no
          date of birth, no identity document. Your password is stored only as a scrypt
          hash and cannot be read back by anyone, including us.
        </p>
      </section>

      <section className="tt-card rounded-xl border border-line p-6">
        <h2 className="text-lg font-medium">Sessions</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Signing out clears the session on this device. Sessions expire on their own
          after 12 hours.
        </p>
        <button
          type="button"
          onClick={signOut}
          className="mt-4 rounded-lg border border-line px-5 py-2.5 text-sm text-ink transition hover:bg-raised"
        >
          Log out
        </button>
      </section>

      <section className="rounded-xl border border-attention-line bg-attention-bg p-6">
        <h2 className="flex items-center gap-2 text-lg font-medium text-attention">
          <IconShieldOff className="h-5 w-5" />
          Delete this account
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-attention">
          This cannot be undone. Because we hold no contact details, there is no way to
          restore an account or recover access to its cases afterwards.
        </p>

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-4 rounded-lg border border-attention px-5 py-2.5 text-sm text-attention transition hover:bg-attention-bg"
          >
            Delete account
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <label htmlFor="confirm-delete" className="block text-sm text-attention">
              Type your username <strong>{user?.username}</strong> to confirm.
            </label>
            <input
              id="confirm-delete"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="w-full max-w-sm rounded-lg border border-attention-line bg-surface px-3 py-2.5 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-attention"
            />
            {error && <p role="alert" className="text-sm text-attention">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={busy || typed !== user?.username}
                onClick={remove}
                className="rounded-lg bg-attention px-5 py-2.5 text-sm font-medium text-attention-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Deleting…" : "Permanently delete"}
              </button>
              <button
                type="button"
                onClick={() => { setConfirming(false); setTyped(""); }}
                className="rounded-lg border border-line bg-surface px-5 py-2.5 text-sm text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
