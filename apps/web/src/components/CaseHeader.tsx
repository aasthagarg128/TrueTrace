"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { shortRef, type Case } from "@/lib/api";

/** Shared header + tab strip for a case, so /evidence and /report keep context. */
export default function CaseHeader({ kase }: { kase: Case }) {
  const pathname = usePathname();
  const base = `/cases/${kase.case_id}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/evidence`, label: "Evidence" },
    { href: `${base}/report`, label: "Report" },
  ];

  return (
    <header className="space-y-4">
      <Link href="/cases" className="text-sm text-muted hover:text-ink">
        ← My cases
      </Link>

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">
          {shortRef(kase.case_id)}
        </h1>
        <p className="text-xs text-subtle">
          Created {new Date(kase.created_at).toLocaleString()}
        </p>
      </div>

      <p className="break-all text-xs text-subtle">{kase.source_url}</p>

      <nav className="flex gap-1 border-b border-line" aria-label="Case sections">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2 text-sm transition ${
                active
                  ? "border-accent font-medium text-accent"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
