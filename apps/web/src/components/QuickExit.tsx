"use client";

import { useEffect, useState } from "react";

/**
 * Quick exit — a standard safety control in services for people experiencing
 * abuse, and one this product needs.
 *
 * Someone may be using TrueTrace on a shared or monitored device, with the
 * person who harmed them nearby. This has to get them off the page instantly
 * and leave as little trace as possible:
 *
 *  - `location.replace` rather than `assign`, so the current page is dropped
 *    from history and the Back button will not return to it.
 *  - the new tab is opened first, so the destination is already loading before
 *    this page goes away.
 *  - triple-Escape works too, for when reaching the mouse is not an option.
 *
 * It cannot erase browser history entirely — no web page can — so the UI says
 * so plainly rather than implying a safety it cannot deliver.
 */
const SAFE_DESTINATION = "https://www.google.com/search?q=weather";

export function useQuickExit() {
  return () => {
    try {
      window.open(SAFE_DESTINATION, "_blank", "noopener,noreferrer");
    } catch {
      /* popup blocked - the replace below still gets them away */
    }
    window.location.replace(SAFE_DESTINATION);
  };
}

export default function QuickExit() {
  const exit = useQuickExit();
  const [hint, setHint] = useState(false);

  useEffect(() => {
    let taps = 0;
    let timer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      taps += 1;
      clearTimeout(timer);
      if (taps >= 3) exit();
      timer = setTimeout(() => (taps = 0), 800);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [exit]);

  return (
    <div className="flex items-center gap-2">
      {hint && (
        <span className="hidden text-[11px] text-slate-500 sm:inline">
          or press Esc three times
        </span>
      )}
      <button
        type="button"
        onClick={exit}
        onMouseEnter={() => setHint(true)}
        onFocus={() => setHint(true)}
        className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 ring-offset-slate-950 transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        Quick exit
      </button>
    </div>
  );
}
