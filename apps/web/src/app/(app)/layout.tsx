"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  IconDraft,
  IconIncognito,
  IconLifebuoy,
  IconLink,
  IconLock,
  IconSeal,
} from "@/components/Art";

/**
 * Private chrome: persistent sidebar, and the gate that keeps everything under
 * it signed-in only.
 *
 * The guard is client-side because the API is the real boundary — every case
 * route already requires a bearer token and returns 404 for another user's
 * case. This redirect is for orientation, not security.
 */

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: IconSeal },
  { href: "/cases", label: "My Cases", Icon: IconDraft },
  { href: "/cases/new", label: "New Case", Icon: IconLink },
  { href: "/account", label: "Account", Icon: IconIncognito },
];

const SECONDARY = [
  { href: "/privacy", label: "Privacy", Icon: IconLock },
  { href: "/help", label: "Help", Icon: IconLifebuoy },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <p className="text-sm text-subtle">
          {loading ? "Checking your session…" : "Redirecting to sign in…"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ------------------------------------------------------- sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface lg:flex lg:flex-col">
        <div className="px-6 py-5">
          <Link href="/dashboard" className="text-base font-semibold tracking-tight">
            TrueTrace
          </Link>
        </div>
        <SidebarNav pathname={pathname} />
        <div className="mt-auto border-t border-line p-4">
          <p className="truncate px-2 text-xs text-subtle">
            Signed in as <span className="text-muted">{user.username}</span>
          </p>
          <button
            type="button"
            onClick={signOut}
            className="mt-2 w-full rounded-lg px-2 py-2 text-left text-sm text-muted transition hover:bg-raised hover:text-ink"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* -------------------------------------------------- mobile topbar */}
      <header className="flex items-center justify-between border-b border-line bg-surface px-5 py-3 lg:hidden">
        <Link href="/dashboard" className="text-base font-semibold tracking-tight">
          TrueTrace
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          className="mr-24 rounded-md border border-line px-3 py-1.5 text-xs text-muted"
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </header>

      {menuOpen && (
        <div id="mobile-nav" className="border-b border-line bg-surface lg:hidden">
          <SidebarNav pathname={pathname} />
          <div className="border-t border-line p-4">
            <p className="px-2 text-xs text-subtle">Signed in as {user.username}</p>
            <button
              type="button"
              onClick={signOut}
              className="mt-2 rounded-lg px-2 py-1.5 text-sm text-muted hover:text-ink"
            >
              Log out
            </button>
          </div>
        </div>
      )}

      <main id="main" className="min-w-0 flex-1 px-6 py-8 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}

function SidebarNav({ pathname }: { pathname: string }) {
  return (
    <nav className="p-3">
      <ul className="space-y-1">
        {NAV.map(({ href, label, Icon }) => {
          // /cases must not light up while on /cases/new.
          const active = href === "/cases" ? pathname === "/cases" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-muted hover:bg-raised hover:text-ink"
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          {/* Monitoring is specified but not built. Showing it as available
              would be a promise the product cannot keep. */}
          <span
            aria-disabled
            title="Not available yet"
            className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-subtle opacity-60"
          >
            <IconLifebuoy className="h-4.5 w-4.5" />
            Monitoring
            <span className="ml-auto rounded-full border border-line px-1.5 py-0.5 text-[10px]">
              soon
            </span>
          </span>
        </li>
      </ul>

      <hr className="my-3 border-line" />

      <ul className="space-y-1">
        {SECONDARY.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-raised hover:text-ink"
            >
              <Icon className="h-4.5 w-4.5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
