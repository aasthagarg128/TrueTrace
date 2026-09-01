/**
 * Illustration set — authored inline as SVG, deliberately.
 *
 * Three reasons this is not an image library or a CDN:
 *  1. Privacy. A page for people documenting abuse should make zero third-party
 *     requests. Every remote asset is a request that leaks who visited, when.
 *  2. Theming. `currentColor` and CSS variables mean one drawing works in both
 *     light and dark without a second file.
 *  3. Weight. No loading states, no layout shift, a few KB total.
 *
 * Subject matter is abstract on purpose: shields, seals, documents, signals.
 * No faces, no figures, nothing depicting distress. Someone arriving here is
 * already living the thing an illustration would be dramatising.
 */

export function HeroArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 260"
      role="img"
      aria-label="A document being sealed and verified"
      className={className}
    >
      <defs>
        <linearGradient id="tt-shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.30" />
          <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.10" />
        </linearGradient>
        <linearGradient id="tt-page" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--surface)" />
          <stop offset="100%" stopColor="var(--raised)" />
        </linearGradient>
        <radialGradient id="tt-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="210" cy="120" rx="190" ry="120" fill="url(#tt-glow)" />

      {/* concentric signal rings — slow, calm, not a "scanning" alarm */}
      <g stroke="var(--accent)" fill="none" opacity="0.28">
        <circle cx="210" cy="122" r="96" strokeWidth="1" className="tt-ring tt-ring-1" />
        <circle cx="210" cy="122" r="118" strokeWidth="1" className="tt-ring tt-ring-2" />
      </g>

      {/* the record itself */}
      <g className="tt-float">
        <rect
          x="150" y="52" width="120" height="150" rx="10"
          fill="url(#tt-page)" stroke="var(--line)" strokeWidth="1.5"
        />
        <g stroke="var(--muted)" strokeWidth="4" strokeLinecap="round" opacity="0.35">
          <path d="M170 84h58" />
          <path d="M170 100h80" />
          <path d="M170 116h68" />
        </g>
        {/* hash lines — the evidence fingerprint */}
        <g stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.7">
          <path d="M170 140h34" />
          <path d="M210 140h26" />
          <path d="M170 152h20" />
          <path d="M196 152h44" />
        </g>

        {/* seal */}
        <circle cx="240" cy="182" r="21" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5" />
        <path
          d="M231 182.5l6.4 6.4L250 176.5"
          fill="none" stroke="var(--accent)" strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round"
          className="tt-check"
        />
      </g>

      {/* shield behind, suggesting protection without a lock cliché */}
      <path
        d="M92 74l38-16 38 16v44c0 30-19 50-38 58-19-8-38-28-38-58z"
        fill="url(#tt-shield)" stroke="var(--accent)" strokeWidth="1.2" opacity="0.85"
        className="tt-float-slow"
      />
      <path
        d="M292 92l32-13 32 13v37c0 25-16 42-32 49-16-7-32-24-32-49z"
        fill="url(#tt-shield)" stroke="var(--accent-2)" strokeWidth="1.2" opacity="0.6"
        className="tt-float-slower"
      />
    </svg>
  );
}

/* ---------- step icons ---------- */

const ICON = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconLink({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...ICON}>
      <path d="M10 13.5a4 4 0 0 0 5.7.4l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
      <path d="M14 10.5a4 4 0 0 0-5.7-.4l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </svg>
  );
}

export function IconSeal({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...ICON}>
      <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z" />
      <path d="M9 12.2l2.2 2.2L15.5 10" />
    </svg>
  );
}

export function IconDraft({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...ICON}>
      <path d="M6 3.5h8.5L19 8v12.5H6z" />
      <path d="M14 3.5V8h5" />
      <path d="M9 12.5h7M9 16h5" />
    </svg>
  );
}

export function IconSend({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...ICON}>
      <path d="M20.5 3.5L10 14" />
      <path d="M20.5 3.5l-6.6 17-3.9-6.5-6.5-3.9z" />
    </svg>
  );
}

export function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...ICON}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.3l2.4 2.4 4.6-4.9" />
    </svg>
  );
}

export function IconShieldOff({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...ICON}>
      <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z" />
      <path d="M12 8.5v4.5M12 16h.01" />
    </svg>
  );
}

export function IconLifebuoy({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...ICON}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M9.5 9.5L6 6M14.5 9.5L18 6M9.5 14.5L6 18M14.5 14.5L18 18" />
    </svg>
  );
}

export const STEP_ICONS = [IconLink, IconSeal, IconDraft, IconSend];
