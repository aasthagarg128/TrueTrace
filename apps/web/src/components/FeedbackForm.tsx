"use client";

import { useState } from "react";
import { ApiError, sendFeedback } from "@/lib/api";
import { IconCheck } from "@/components/Art";

/**
 * Feedback is deliberately anonymous-first: no field is required except the
 * message itself. A star rating and a way to be contacted back are both
 * opt-in, mirroring the account model - you should never have to give up
 * more identity than the thing you're doing requires.
 */
export default function FeedbackForm({ page = "landing" }: { page?: string }) {
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setState("sending");
    setError(null);
    try {
      await sendFeedback({ message: message.trim(), rating, contact: contact.trim() || null, page });
      setState("sent");
      setMessage("");
      setRating(null);
      setContact("");
    } catch (err) {
      setState("error");
      setError(
        err instanceof ApiError ? err.message : "Could not send that. Please try again.",
      );
    }
  }

  if (state === "sent") {
    return (
      <div className="tt-card tt-rise flex items-center gap-3 rounded-xl border border-line p-6">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <IconCheck className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-medium text-ink">Thank you — that was sent.</p>
          <p className="mt-0.5 text-xs text-muted">
            No case, video, or evidence data is ever attached to feedback.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="tt-focus ml-auto shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs text-ink hover:bg-raised"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="tt-card rounded-xl border border-line p-6">
      <label htmlFor="fb-message" className="block text-sm font-medium text-ink">
        What could be better?
      </label>
      <p className="mt-1 text-xs text-muted">
        Bugs, missing platforms, confusing wording — anything. This is not tied to
        any case you have open.
      </p>
      <textarea
        id="fb-message"
        rows={3}
        required
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={4000}
        placeholder="Tell us what happened, or what you'd like to see."
        className="mt-3 w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">Rating, optional</legend>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={rating === n}
              onClick={() => setRating(rating === n ? null : n)}
              className={`tt-focus h-8 w-8 rounded-md text-lg leading-none transition ${
                rating !== null && n <= rating
                  ? "text-accent"
                  : "text-subtle hover:text-muted"
              }`}
            >
              ★
            </button>
          ))}
          <span className="ml-1 text-xs text-subtle">{rating ? `${rating}/5` : "optional rating"}</span>
        </fieldset>
      </div>

      <div className="mt-4">
        <label htmlFor="fb-contact" className="block text-xs text-muted">
          Contact (optional) — only if you&apos;re open to us following up
        </label>
        <input
          id="fb-contact"
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Email or leave blank"
          className="mt-1.5 w-full max-w-sm rounded-lg border border-line bg-raised px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-attention-line bg-attention-bg px-3 py-2 text-xs text-attention">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === "sending" || !message.trim()}
        className="tt-press tt-focus mt-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
