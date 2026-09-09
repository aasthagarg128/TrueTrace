"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { IconIncognito } from "@/components/Art";
import GoogleSignIn from "@/components/GoogleSignIn";
import PasswordField from "@/components/PasswordField";
import { signup } from "@/lib/api";

const MIN_PASSWORD = 8;
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;

/** Suggest a handle with no personal information in it. */
function suggestion() {
  const n = Math.floor(100 + Math.random() * 900);
  return `case-helper-${n}`;
}

export default function SignupPage() {
  const router = useRouter();
  const { user, signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placeholder = useMemo(suggestion, []);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  const userValid = USERNAME_RE.test(username.trim());
  const pwValid = password.length >= MIN_PASSWORD;
  const match = password.length > 0 && password === confirm;
  const canSubmit = userValid && pwValid && match && agreed && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token, user: u } = await signup(username.trim(), password);
      signIn(token, u);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
      setBusy(false);
    }
  }

  return (
    <div className="tt-card rounded-2xl border border-line p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-muted">
        You don&apos;t need to use your real name.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-ink">
            Pseudonymous username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={`e.g. ${placeholder}`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-describedby="username-hint"
            className="mt-2 w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <p id="username-hint" className="mt-1.5 text-xs text-subtle">
            {username && !userValid
              ? "3–32 characters: letters, numbers, dot, underscore or hyphen."
              : "Pick something unconnected to your real identity."}
          </p>
        </div>

        <PasswordField
          id="password"
          label="Password"
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
          label="Confirm password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          hint={confirm && !match ? "The two passwords do not match." : undefined}
        />

        <label className="flex gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
          />
          <span className="text-sm text-muted">
            I agree to the{" "}
            <Link href="/privacy" className="text-accent underline underline-offset-2">
              Terms &amp; Privacy Policy
            </Link>
            .
          </span>
        </label>

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
          disabled={!canSubmit}
          className="w-full rounded-lg bg-accent px-5 py-3 text-sm font-medium text-accent-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>

      <GoogleSignIn
        label="signup_with"
        onSignedIn={(token, u) => {
          signIn(token, u);
          router.replace("/dashboard");
        }}
      />

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent underline underline-offset-2 hover:opacity-80">
          Log in
        </Link>
      </p>

      <p className="mt-6 flex items-start gap-2 rounded-lg bg-raised px-3 py-2.5 text-xs leading-relaxed text-muted">
        <IconIncognito className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>
          We ask for a username and a password. Not your name, email, phone number,
          date of birth, or any identity document. Because we hold no contact details,
          a forgotten password cannot be recovered.
        </span>
      </p>
    </div>
  );
}
