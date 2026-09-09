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
 *     behind a divider, because choosing it trades pseudonymity toward Google
 *     for convenience, and that trade should be a decision rather than the
 *     default path.
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let clientId: string | null = null;
      try {
        const cfg = await authConfig();
        if (!cfg.google_enabled || !cfg.google_client_id) return;
        clientId = cfg.google_client_id;
      } catch {
        return; // server unreachable: stay hidden, password form is unaffected
      }
      if (cancelled) return;

      try {
        await loadScript();
      } catch {
        return; // script blocked by the browser or an extension
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

  return (
    <div className={enabled ? "mt-6" : "hidden"}>
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
        Signing in with Google tells Google you use TrueTrace, and is not
        pseudonymous toward them. We still store only an opaque account id — never
        your name or email. For maximum privacy, use a username and password.
      </p>
    </div>
  );
}
