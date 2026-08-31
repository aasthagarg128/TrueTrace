import type { Metadata } from "next";
import Link from "next/link";
import QuickExit from "@/components/QuickExit";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrueTrace",
  description:
    "Document manipulated video of yourself and file the correct takedown report.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-canvas text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-accent-ink"
        >
          Skip to content
        </a>

        <header className="border-b border-line">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-baseline gap-5">
              <Link
                href="/"
                className="text-base font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                TrueTrace
              </Link>
              <Link
                href="/cases"
                className="text-xs text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Your cases
              </Link>
            </div>
            <QuickExit />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
          {children}
        </main>

        <footer className="mx-auto w-full max-w-4xl px-6 pb-12 pt-4">
          <p className="text-xs leading-relaxed text-subtle">
            TrueTrace provides information, not legal advice. Automated screening is
            indicative only and is never a determination that a video is or is not
            manipulated. Quick exit leaves this page immediately, but it cannot clear
            your browser history.
          </p>
        </footer>
      </body>
    </html>
  );
}
