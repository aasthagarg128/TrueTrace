import type { Metadata } from "next";
import AuthProvider from "@/components/AuthProvider";
import QuickExit from "@/components/QuickExit";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrueTrace",
  description:
    "Detect manipulated content, preserve evidence, and prepare platform-specific takedown reports.",
};

/**
 * Root layout holds only what every area needs: the auth session, and the quick
 * exit control. Chrome differs by area on purpose — public marketing, the
 * authentication screens, and the private dashboard should not look alike.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-accent-ink"
        >
          Skip to content
        </a>
        {/* Reachable from every screen, including mid-analysis. */}
        <div className="fixed right-4 top-4 z-40">
          <QuickExit />
        </div>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
