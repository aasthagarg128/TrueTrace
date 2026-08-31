"use client";

import { useState } from "react";

/**
 * A single still frame, blurred, behind an explicit action.
 *
 * Three rules this component exists to enforce:
 *  1. The source video is never embedded and never played. Only one still frame
 *     ever reaches the browser.
 *  2. The blur is on by default on EVERY mount, and the reveal is deliberately
 *     not remembered - returning to the case should not ambush someone with the
 *     image because they once chose to look.
 *  3. Revealing is always reversible, and the control says so plainly.
 */
export default function BlurredPreview({ b64, alt }: { b64: string; alt: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <figure className="overflow-hidden rounded-xl border border-line/60 bg-raised">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/jpeg;base64,${b64}`}
          alt={revealed ? alt : "Preview frame, hidden"}
          className={`h-56 w-full object-cover transition-[filter] duration-200 ${
            revealed ? "" : "blur-2xl"
          }`}
          draggable={false}
        />
        {!revealed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas/50 p-4 text-center">
            <p className="max-w-xs text-sm text-muted">
              A single frame from this content is hidden. You do not need to look at it
              to file a report.
            </p>
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-raised"
            >
              Show this frame
            </button>
          </div>
        )}
      </div>
      <figcaption className="flex items-center justify-between border-t border-line/60 px-4 py-2 text-xs text-muted">
        <span>One still frame. The video is never played here.</span>
        {revealed && (
          <button
            type="button"
            onClick={() => setRevealed(false)}
            className="text-muted underline underline-offset-2 hover:text-ink"
          >
            Hide again
          </button>
        )}
      </figcaption>
    </figure>
  );
}
