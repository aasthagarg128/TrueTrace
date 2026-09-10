import Link from "next/link";
import { WelcomeArt } from "@/components/Art";

/**
 * Authentication chrome: a centred card and nothing else.
 *
 * No marketing navigation and no dashboard navigation appear here. This screen
 * has exactly one job, and every extra link is a way to lose someone who is
 * already stressed.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="tt-ambient flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <WelcomeArt className="tt-fade mb-2 h-24 w-auto" />
      <Link
        href="/"
        className="tt-focus rounded text-lg font-semibold tracking-tight focus-visible:outline-none"
      >
        TrueTrace
      </Link>
      <main id="main" className="tt-rise tt-d1 mt-6 w-full max-w-md">
        {children}
      </main>
      <p className="mt-8 max-w-md text-center text-xs leading-relaxed text-subtle">
        TrueTrace never asks for your real name, email address, or phone number.
      </p>
    </div>
  );
}
