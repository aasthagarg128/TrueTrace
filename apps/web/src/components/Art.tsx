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

/* ---------- section illustrations ---------- */

/**
 * The pipeline, drawn. This is the clearest "what does it actually do" signal
 * on the page: frames are sampled, hashed, sealed. It animates once on view
 * rather than looping forever — a permanent loop competes with the form.
 */
export function PipelineArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 460 140" role="img" aria-label="Frames sampled, hashed, then sealed" className={className}>
      <defs>
        <linearGradient id="tt-flow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
          <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      <path d="M40 70h380" stroke="url(#tt-flow)" strokeWidth="2" fill="none" />

      {/* sampled frames */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i} className={`tt-rise tt-d${i + 1}`}>
          <rect
            x={44 + i * 34} y="46" width="26" height="34" rx="4"
            fill="var(--surface)" stroke="var(--line)" strokeWidth="1.2"
          />
          <circle cx={57 + i * 34} cy="60" r="5" fill="var(--accent)" opacity="0.35" />
          <path d={`M${49 + i * 34} 74h14`} stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        </g>
      ))}

      {/* hash */}
      <g className="tt-rise tt-d3">
        <rect x="196" y="50" width="86" height="26" rx="6" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.2" />
        <text x="239" y="67" textAnchor="middle" fontSize="11" fontFamily="ui-monospace, monospace" fill="var(--accent)">
          sha-256
        </text>
      </g>

      {/* sealed record */}
      <g className="tt-rise tt-d4">
        <rect x="316" y="34" width="72" height="72" rx="10" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.5" />
        <path
          d="M338 70l9 9 18-19"
          fill="none" stroke="var(--accent)" strokeWidth="3.5"
          strokeLinecap="round" strokeLinejoin="round" className="tt-check"
        />
        <path d="M352 34v-6a10 10 0 0 1 20 0v6" fill="none" stroke="var(--accent)" strokeWidth="0" />
      </g>

      {/* travelling pulse along the line */}
      <circle r="3.5" fill="var(--accent)" className="tt-travel">
        <animateMotion dur="3.4s" repeatCount="indefinite" path="M40 70h380" />
      </circle>
    </svg>
  );
}

/** Evidence record: a sealed, hashed document. */
export function EvidenceArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label="A sealed evidence record" className={className}>
      <rect x="26" y="14" width="68" height="88" rx="8" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" />
      <g stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" opacity="0.55">
        <path d="M40 36h26" /><path d="M72 36h10" />
        <path d="M40 48h16" /><path d="M62 48h20" />
        <path d="M40 60h34" />
      </g>
      <circle cx="60" cy="84" r="16" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5" />
      <path d="M53 84.5l5 5 9.5-10" fill="none" stroke="var(--accent)" strokeWidth="2.6"
            strokeLinecap="round" strokeLinejoin="round" className="tt-check" />
    </svg>
  );
}

/** Takedown report: a document heading out. */
export function ReportArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label="A takedown report being sent" className={className}>
      <rect x="18" y="18" width="62" height="80" rx="8" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" />
      <g stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" opacity="0.45">
        <path d="M30 38h34" /><path d="M30 50h38" /><path d="M30 62h28" /><path d="M30 74h34" />
      </g>
      <g className="tt-float">
        <circle cx="88" cy="42" r="20" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5" />
        <path d="M96 34L80 46" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M96 34l-5.6 15.4-3.3-6.1-6.1-3.3z" fill="var(--accent)" opacity="0.85" />
      </g>
    </svg>
  );
}

/** Generic platform mark. Deliberately NOT a brand logo — those are trademarked,
 *  and a wrong-looking imitation reads as untrustworthy on a page about proof. */
export function PlatformMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...ICON}>
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
      <path d="M10.5 9.5l4.5 2.5-4.5 2.5z" />
    </svg>
  );
}

export function IconLock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...ICON}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  );
}

export function IconClock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...ICON}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

export function IconIncognito({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} {...ICON}>
      <path d="M4 11.5h16" />
      <path d="M6.5 11.5l1.6-4.2a2 2 0 0 1 1.9-1.3h4a2 2 0 0 1 1.9 1.3l1.6 4.2" />
      <circle cx="8" cy="15.5" r="2.8" />
      <circle cx="16" cy="15.5" r="2.8" />
      <path d="M10.8 15.5h2.4" />
    </svg>
  );
}

/**
 * Privacy section hero: a document inside a shield, with no lines of text
 * visible through it — the point is that what's inside stays inside, not a
 * padlock cliché repeated a second time on the same page.
 */
export function PrivacyArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 170" role="img" aria-label="A private record, visible to no one else" className={className}>
      <defs>
        <linearGradient id="tt-priv-shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.24" />
          <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.08" />
        </linearGradient>
        <radialGradient id="tt-priv-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="150" cy="88" rx="140" ry="82" fill="url(#tt-priv-glow)" />

      <g stroke="var(--accent)" fill="none" opacity="0.22">
        <circle cx="150" cy="86" r="66" strokeWidth="1" className="tt-ring tt-ring-1" style={{ transformOrigin: "150px 86px" }} />
      </g>

      {/* orbiting dots stand in for "your data", each held at a distance,
          never converging on a single exposed record */}
      <g className="tt-float-slow">
        {[0, 120, 240].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x = 150 + Math.cos(rad) * 100;
          const y = 86 + Math.sin(rad) * 58;
          return <circle key={deg} cx={x} cy={y} r="4" fill="var(--accent)" opacity="0.45" />;
        })}
      </g>

      <path
        d="M150 24l52 20v40c0 36-24 60-52 68-28-8-52-32-52-68V44z"
        fill="url(#tt-priv-shield)" stroke="var(--accent)" strokeWidth="1.4"
        className="tt-float"
      />

      {/* a document, face-down and unreadable, inside the shield */}
      <rect x="122" y="60" width="56" height="70" rx="6" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.3" />
      <g stroke="var(--muted)" strokeWidth="3" strokeLinecap="round" opacity="0.25">
        <path d="M132 78h20" /><path d="M132 90h30" /><path d="M132 102h24" />
      </g>
      <circle cx="150" cy="118" r="9" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.3" />
      <path d="M146 118l2.6 2.6 5.4-6" fill="none" stroke="var(--accent)" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" className="tt-check" />
    </svg>
  );
}

/** Feedback: a message arriving and being read, not sent into a void. */
export function FeedbackArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" role="img" aria-label="A message being read" className={className}>
      <rect x="10" y="14" width="72" height="50" rx="10" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.4" />
      <path d="M10 20l36 26 36-26" fill="none" stroke="var(--muted)" strokeWidth="2" opacity="0.4" strokeLinecap="round" strokeLinejoin="round" />
      <g className="tt-float-slow">
        <circle cx="90" cy="58" r="22" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5" />
        <path d="M81 58l6.5 6.5L100 51" fill="none" stroke="var(--accent)" strokeWidth="2.6"
              strokeLinecap="round" strokeLinejoin="round" className="tt-check" />
      </g>
    </svg>
  );
}

/* ---------- states and moments ---------- */

/**
 * Empty case list. Calm and slightly hopeful rather than sad — an empty list
 * here is a good state, not a failure, and the art should not imply otherwise.
 */
export function EmptyCasesArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 130" role="img" aria-label="No cases yet" className={className}>
      <defs>
        <linearGradient id="tt-empty" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--surface)" />
          <stop offset="100%" stopColor="var(--raised)" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="112" rx="66" ry="9" fill="var(--accent)" opacity="0.09" />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={50 + i * 6} y={30 + i * 13} width={100 - i * 12} height="26" rx="6"
          fill="url(#tt-empty)" stroke="var(--line)" strokeWidth="1.2"
          opacity={1 - i * 0.26}
        />
      ))}
      <g className="tt-float-slow">
        <circle cx="150" cy="40" r="17" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.4" />
        <path d="M150 32.5v15M142.5 40h15" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Sign-in art: a shield forming around a key. Protection, not surveillance. */
export function WelcomeArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 110" role="img" aria-label="A private, protected space" className={className}>
      <defs>
        <linearGradient id="tt-welcome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.26" />
          <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.10" />
        </linearGradient>
      </defs>
      <g stroke="var(--accent)" fill="none" opacity="0.22">
        <circle cx="80" cy="56" r="40" strokeWidth="1" className="tt-ring tt-ring-1" style={{ transformOrigin: "80px 56px" }} />
      </g>
      <path
        d="M80 18l30 12v26c0 21-14 34-30 40-16-6-30-19-30-40V30z"
        fill="url(#tt-welcome)" stroke="var(--accent)" strokeWidth="1.4"
        className="tt-float-slower"
      />
      <circle cx="80" cy="52" r="9" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <path d="M80 61v13M80 68h6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Live pipeline for a case in progress.
 *
 * Replaces a static list with something that shows the work actually moving:
 * each completed stage fills, the active one pulses, and a pulse travels the
 * connecting line. The point is reassurance — someone waiting on this is
 * anxious, and a page that looks frozen makes that worse.
 */
export function LivePipelineArt({
  stage,
  className = "",
}: {
  stage: number; // index of the active stage, -1 before anything starts
  className?: string;
}) {
  const nodes = [0, 1, 2, 3, 4, 5];
  const x = (i: number) => 26 + i * 49.6;

  return (
    <svg viewBox="0 0 280 56" role="img" aria-label={`Step ${Math.max(stage + 1, 1)} of 6`} className={className}>
      <line x1="26" y1="28" x2="274" y2="28" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" />
      {stage >= 0 && (
        <line
          x1="26" y1="28" x2={Math.min(x(stage), 274)} y2="28"
          stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"
          style={{ transition: "all .6s cubic-bezier(.2,.7,.3,1)" }}
        />
      )}

      {nodes.map((i) => {
        const done = stage > i;
        const active = stage === i;
        return (
          <g key={i}>
            <circle
              cx={x(i)} cy="28" r={active ? 9 : 7}
              fill={done ? "var(--accent)" : "var(--surface)"}
              stroke={done || active ? "var(--accent)" : "var(--line)"}
              strokeWidth="2"
              style={{ transition: "all .4s ease" }}
            />
            {done && (
              <path
                d={`M${x(i) - 3.4} 28l2.6 2.6 4.6-5`}
                fill="none" stroke="var(--accent-ink)" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
              />
            )}
            {active && (
              <circle
                cx={x(i)} cy="28" r="9" fill="none"
                stroke="var(--accent)" strokeWidth="2"
                className="tt-ring"
                style={{ transformOrigin: `${x(i)}px 28px` }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
