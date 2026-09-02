"use client";

import { useState } from "react";

/**
 * Password input with a show/hide toggle.
 *
 * The toggle matters more here than in a typical product: people using
 * TrueTrace may be on an unfamiliar device, under stress, and a mistyped
 * password on a service with no email recovery is a locked door. Hidden is
 * still the default — revealing is a deliberate act, because they may not be
 * alone.
 */
export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  hint?: string;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          name={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="w-full rounded-lg border border-line bg-raised px-3 py-2.5 pr-11 text-sm text-ink focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {shown ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Eye() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden {...S}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden {...S}>
      <path d="M4 4l16 16" />
      <path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.3 4.1" />
      <path d="M6.4 7.6A17 17 0 0 0 2.5 12S6 18.5 12 18.5c1.2 0 2.2-.2 3.2-.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
