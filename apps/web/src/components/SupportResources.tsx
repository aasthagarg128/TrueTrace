/**
 * Real support, alongside the tooling.
 *
 * TrueTrace automates paperwork. It does not help someone through the hardest
 * part, and pretending otherwise would be a disservice — so the people who
 * actually do that work are named here, on every page, not buried in a footer.
 *
 * Every entry below was verified against the organisation's own site on
 * 2026-08-29. Nothing here is invented: a wrong helpline number in this context
 * is worse than no helpline at all.
 */

import { IconLifebuoy } from "./Art";

interface Resource {
  name: string;
  href: string;
  detail: string;
  contact?: string;
}

const RESOURCES: Resource[] = [
  {
    name: "CCRI Image Abuse Helpline",
    href: "https://cybercivilrights.org/ccri-safety-center/",
    detail:
      "Free, 24/7. Emotional support, takedown guidance, and attorney referrals. Interpretation in most languages.",
    contact: "1-844-878-2274",
  },
  {
    name: "StopNCII.org",
    href: "https://stopncii.org/how-it-works/",
    detail:
      "If you have the image or video yourself, this creates a fingerprint of it on your device and shares only that — never the file — so partner platforms can block re-uploads. For adults 18+.",
  },
  {
    name: "FTC — Take It Down",
    href: "https://takeitdown.ftc.gov",
    detail:
      "Report platforms that fail to remove intimate imagery, or that make reporting difficult.",
  },
];

export default function SupportResources({ compact = false }: { compact?: boolean }) {
  return (
    <section
      aria-labelledby="support-heading"
      className="tt-card tt-rise rounded-xl border border-line p-5"
    >
      <h2 id="support-heading" className="flex items-center gap-2 text-sm font-medium text-ink">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent">
          <IconLifebuoy className="h-5 w-5" />
        </span>
        You don&apos;t have to do this alone
      </h2>
      {!compact && (
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          TrueTrace handles the paperwork. These organisations help with the rest, and
          they do it for free.
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {RESOURCES.map((r) => (
          <li key={r.href}>
            <a
              href={r.href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm font-medium text-accent underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {r.name}
            </a>
            {r.contact && (
              <a
                href={`tel:${r.contact.replace(/[^0-9+]/g, "")}`}
                className="ml-2 rounded bg-raised px-1.5 py-0.5 font-mono text-xs text-ink hover:opacity-80"
              >
                {r.contact}
              </a>
            )}
            <p className="mt-0.5 text-xs leading-relaxed text-subtle">{r.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
