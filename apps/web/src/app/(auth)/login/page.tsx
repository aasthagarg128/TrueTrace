"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { IconLock } from "@/components/Art";
import GoogleSignIn from "@/components/GoogleSignIn";
import PasswordField from "@/components/PasswordField";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { user, signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token, user: u } = await login(username.trim(), password);
      signIn(token, u);
      router.replace("/dashboard");
    } catch (err) {
      // The server deliberately returns the same message for a wrong password
      // and an unknown username; do not embellish it here.
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <div className="tt-card rounded-2xl border border-line p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted">Access your TrueTrace cases.</p>

      <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-ink">
            Username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-2 w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
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
          disabled={busy || !username.trim() || !password}
          className="w-full rounded-lg bg-accent px-5 py-3 text-sm font-medium text-accent-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Signing in…" : "Log in"}
        </button>
      </form>

      <GoogleSignIn
        label="signin_with"
        onSignedIn={(token, u) => {
          signIn(token, u);
          router.replace("/dashboard");
        }}
      />

      <p className="mt-6 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-accent underline underline-offset-2 hover:opacity-80">
          Create account
        </Link>
      </p>

      <p className="mt-6 flex items-start gap-2 rounded-lg bg-raised px-3 py-2.5 text-xs leading-relaxed text-muted">
        <IconLock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>
          Your account can remain pseudonymous. There is no password reset, because
          recovery would require contact details we deliberately never collect — keep
          your password somewhere safe.
        </span>
      </p>
    </div>
  );
}
