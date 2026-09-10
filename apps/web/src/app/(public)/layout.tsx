"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

/**
 * Public chrome: marketing navigation, and the two authentication entry points.
 * Deliberately shares nothing with the dashboard shell — a visitor should never
 * be looking at something that resembles a signed-in workspace.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            TrueTrace
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="/#how-it-works" className="hover:text-ink">How it works</a>
            <a href="/#privacy" className="hover:text-ink">Safety &amp; Privacy</a>
            <a href="/#about" className="hover:text-ink">About</a>
          </nav>

          {/* pr-24 keeps the buttons clear of the fixed Quick exit control. */}
          <div className="flex items-center gap-3 pr-24">
            {loading ? null : user ? (
              <Link
                href="/dashboard"
                className="tt-press tt-focus rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition hover:opacity-90"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-muted hover:text-ink">
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="tt-press tt-focus rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition hover:opacity-90"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-6 py-14">
        {children}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <p className="max-w-xl text-xs leading-relaxed text-subtle">
            TrueTrace provides information, not legal advice. Automated screening is
            indicative only and is never a determination that a video is or is not
            manipulated. Quick exit leaves this page immediately, but it cannot clear
            your browser history.
          </p>
          <nav className="flex gap-5 text-xs text-muted">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/help" className="hover:text-ink">Help &amp; Safety</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
