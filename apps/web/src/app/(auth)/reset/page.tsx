"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import PasswordField from "@/components/PasswordField";
import { resetPassword } from "@/lib/api";

const MIN_PASSWORD = 8;

export default function ResetPageRoute() {
  return (
    <Suspense fallback={<Shell title="Loading…" body="Checking your reset link." />}>
      <ResetPage />
    </Suspense>
  );
}

function ResetPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { signIn } = useAuth();
  const token = search.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwValid = password.length >= MIN_PASSWORD;
  const match = password.length > 0 && password === confirm;

  if (!token) {
    return (
      <Shell
        title="This link is incomplete"
        body="The reset link is missing its token. Request a new one and use the whole link from the email."
        action={{ href: "/forgot", label: "Request a new link" }}
      />
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // A successful reset signs you straight in — you have just proved control
      // of the account, and another login form here would be friction for
      // nothing.
      const { token: session, user } = await resetPassword(token, password);
      signIn(session, user);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password.");
      setBusy(false);
    }
  }

  return (
    <div className="tt-card rounded-2xl border border-line p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-muted">
        This link works once. Any other reset link you have stops working.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
        <PasswordField
          id="password"
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          hint={
            password && !pwValid
              ? `At least ${MIN_PASSWORD} characters.`
              : "A few random words is stronger than one complicated word."
          }
        />
        <PasswordField
          id="confirm"
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          hint={confirm && !match ? "The two passwords do not match." : undefined}
        />

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
          disabled={busy || !pwValid || !match}
          className="tt-press tt-focus w-full rounded-lg bg-accent px-5 py-3 text-sm font-medium text-accent-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Saving…" : "Set new password"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="text-accent underline underline-offset-2 hover:opacity-80">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

function Shell({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="tt-card rounded-2xl border border-line p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
      {action && (
        <Link
          href={action.href}
          className="tt-press tt-focus mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition hover:opacity-90"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
