"use client";

import { useEffect, useRef, useState } from "react";
import { authConfig, googleLogin, type User } from "@/lib/api";

/**
 * Google Sign-In button.
 *
 * Two deliberate constraints, both from the privacy promises this product makes
 * elsewhere:
 *
 *  1. Google's script is loaded ONLY when the server says Google Sign-In is
 *     configured, and only on the two auth screens. Someone who signs in with a
 *     username never causes a request to Google — the "no third-party requests"
 *     property holds for them exactly as before.
 *  2. The button is never the primary action. It sits below the password form
 *     behind a divider, because choosing it tells Google you use TrueTrace,
 *     and that trade should be a decision rather than the default path.
 *
 * If anything fails — script blocked, no client id, network down — the
 * component renders nothing at all and the password form still works.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("blocked")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("blocked"));
    document.head.appendChild(s);
  });
}

export default function GoogleSignIn({
  onSignedIn,
  label = "signin_with",
}: {
  onSignedIn: (token: string, user: User) => void;
  label?: "signin_with" | "signup_with";
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Why the button is absent. Shown in development only: a real user should
  // simply not see an option that does not exist, but the person building this
  // needs to know the difference between "switched off" and "broken".
  const [devReason, setDevReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let clientId: string | null = null;
      try {
        const cfg = await authConfig();
        if (!cfg.google_enabled || !cfg.google_client_id) {
          setDevReason(
            "Google Sign-In is off because GOOGLE_CLIENT_ID is not set in .env. " +
            "Create an OAuth 2.0 Client ID (Web application) in the Google Cloud " +
            "console, add http://localhost:3000 to its authorised JavaScript " +
            "origins, then restart the API.",
          );
          return;
        }
        clientId = cfg.google_client_id;
      } catch {
        setDevReason("Could not reach the API to ask whether Google Sign-In is enabled.");
        return; // stay hidden; the password form is unaffected
      }
      if (cancelled) return;

      try {
        await loadScript();
      } catch {
        setDevReason("Google's script was blocked by the browser or an extension.");
        return;
      }
      if (cancelled || !holder.current || !window.google) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp: { credential?: string }) => {
          if (!resp.credential) return;
          try {
            const { token, user } = await googleLogin(resp.credential);
            onSignedIn(token, user);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Google sign-in failed.");
          }
        },
        // Do not silently re-authenticate someone who may be on a shared device.
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(holder.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: label,
        shape: "rectangular",
      });
      setEnabled(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [onSignedIn, label]);

  if (!enabled) {
    // Nothing at all in production. In development, say why.
    if (process.env.NODE_ENV === "development" && devReason) {
      return (
        <p className="mt-6 rounded-lg border border-dashed border-line px-3 py-2.5 text-xs leading-relaxed text-subtle">
          <span className="font-medium text-muted">Developer note.</span> {devReason}
        </p>
      );
    }
    return null;
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-subtle">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div ref={holder} className="mt-4 flex justify-center" />

      {error && (
        <p role="alert" className="mt-3 text-sm text-attention">
          {error}
        </p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-subtle">
        Signing in with Google tells Google you use TrueTrace. We still store only
        an opaque account id — never your name or email. For the most privacy, sign
        up with a username only.
      </p>
    </div>
  );
}
