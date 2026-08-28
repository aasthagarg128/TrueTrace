import type { Metadata } from "next";
import Link from "next/link";
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
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <header className="border-b border-slate-800">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-tight">TrueTrace</span>
            </Link>
            <span className="text-xs text-slate-500">Pseudonymous · nothing shared</span>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-4xl px-6 pb-12 pt-4">
          <p className="text-xs leading-relaxed text-slate-500">
            TrueTrace provides information, not legal advice. Automated screening is
            indicative only and is never a determination that a video is or is not
            manipulated.
          </p>
        </footer>
      </body>
    </html>
  );
}
