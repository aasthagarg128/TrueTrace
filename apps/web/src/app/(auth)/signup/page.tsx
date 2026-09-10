"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { IconIncognito, IconLock } from "@/components/Art";
import GoogleSignIn from "@/components/GoogleSignIn";
import PasswordField from "@/components/PasswordField";
import { signup } from "@/lib/api";

const MIN_PASSWORD = 8;
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/** A handle with nothing personal in it. */
function suggestion() {
  return `case-helper-${Math.floor(100 + Math.random() * 900)}`;
}

type Mode = "private" | "recoverable";

export default function SignupPage() {
  const router = useRouter();
  const { user, signIn } = useAuth();
  const [mode, setMode] = useState<Mode>("private");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
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
  const emailValid = mode === "private" || EMAIL_RE.test(email.trim());
  const pwValid = password.length >= MIN_PASSWORD;
  const match = password.length > 0 && password === confirm;
  const canSubmit = userValid && emailValid && pwValid && match && agreed && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token, user: u } = await signup(
        username.trim(),
        password,
        mode === "recoverable" ? email.trim() : null,
      );
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

      {/* The choice comes first, because it changes what the form asks for and
          what we end up holding about someone. Burying it below the fields
          would make it read as a detail rather than a decision. */}
      <fieldset className="mt-6">
        <legend className="text-xs font-semibold uppercase tracking-wide text-subtle">
          How do you want to sign in?
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ModeCard
            selected={mode === "private"}
            onSelect={() => setMode("private")}
            title="Username only"
            body="We hold no way to contact you. The most private option."
            caveat="A forgotten password cannot be recovered."
            Icon={IconIncognito}
          />
          <ModeCard
            selected={mode === "recoverable"}
            onSelect={() => setMode("recoverable")}
            title="Username and email"
            body="Adds a way to reset a forgotten password."
            caveat="We store your email address."
            Icon={IconLock}
          />
        </div>
      </fieldset>

      <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
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
            placeholder={`e.g. ${placeholder}`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-describedby="username-hint"
            className="tt-focus mt-2 w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
          />
          <p id="username-hint" className="mt-1.5 text-xs text-subtle">
            {username && !userValid
              ? "3–32 characters: letters, numbers, dot, underscore or hyphen."
              : "Pick something unconnected to your real identity."}
          </p>
        </div>

        {mode === "recoverable" && (
          <div className="tt-rise">
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
              aria-describedby="email-hint"
              className="tt-focus mt-2 w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            <p id="email-hint" className="mt-1.5 text-xs text-subtle">
              {email && !emailValid
                ? "That does not look like an email address."
                : "Used only to reset a forgotten password. Never for anything else."}
            </p>
          </div>
        )}

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
          className="tt-press tt-focus w-full rounded-lg bg-accent px-5 py-3 text-sm font-medium text-accent-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
          Whichever option you pick, we never ask for your real name, phone number,
          date of birth, or any identity document.
        </span>
      </p>
    </div>
  );
}

function ModeCard({
  selected,
  onSelect,
  title,
  body,
  caveat,
  Icon,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  body: string;
  caveat: string;
  Icon: (p: { className?: string }) => React.ReactElement;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`tt-press tt-focus rounded-xl border p-4 text-left transition ${
        selected
          ? "border-accent bg-accent-soft"
          : "border-line bg-surface hover:border-accent/50"
      }`}
    >
      <span className="flex items-center gap-2">
        <Icon className={`h-4.5 w-4.5 ${selected ? "text-accent" : "text-subtle"}`} />
        <span className={`text-sm font-medium ${selected ? "text-accent" : "text-ink"}`}>
          {title}
        </span>
      </span>
      <span className="mt-1.5 block text-xs leading-relaxed text-muted">{body}</span>
      {/* The cost of each option, stated on the option itself. */}
      <span className="mt-1.5 block text-xs leading-relaxed text-subtle">{caveat}</span>
    </button>
  );
}
