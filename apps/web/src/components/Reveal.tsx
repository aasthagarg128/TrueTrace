"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reveals a section when it scrolls into view.
 *
 * This component starts its children at opacity 0, which means a bug here does
 * not degrade to "no animation" — it degrades to "the content is gone". So it
 * fails OPEN, by three independent routes:
 *
 *   1. If the element is already on screen at mount, show it immediately
 *      (synchronously measured, no observer round-trip).
 *   2. A hard timeout shows it regardless after SAFETY_MS. If the observer
 *      never fires — a throttled background tab, an engine that does not
 *      produce frames, anything unforeseen — the content still appears.
 *   3. Reduced motion or a missing IntersectionObserver shows it at once.
 *
 * Motion is an enhancement here, never a precondition for reading the page.
 */
const SAFETY_MS = 1200;

export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const el = ref.current;
    if (reduced || !el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    // Already visible at mount: skip the observer entirely.
    const box = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (box.top < vh && box.bottom > 0) {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      // Start slightly before the section reaches the viewport, so the motion
      // has finished by the time the reader's eye arrives.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    io.observe(el);

    // The guarantee: content appears whether or not the observer ever fires.
    const safety = window.setTimeout(() => {
      setShown(true);
      io.disconnect();
    }, SAFETY_MS);

    return () => {
      io.disconnect();
      window.clearTimeout(safety);
    };
  }, [shown]);

  return (
    <div
      ref={ref}
      className={`tt-reveal ${shown ? "tt-reveal-in" : ""} ${className}`}
      style={{ transitionDelay: shown && delay ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}
