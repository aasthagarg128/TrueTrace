"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiError, getToken, me, setToken, type User } from "@/lib/api";

interface AuthState {
  user: User | null;
  /** Distinguishes "not signed in" from "we have not checked yet" — without it
   *  the app flashes a signed-out UI on every refresh before the check lands. */
  loading: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
}

const Ctx = createContext<AuthState>({
  user: null,
  loading: true,
  signIn: () => {},
  signOut: () => {},
});

export function useAuth() {
  return useContext(Ctx);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    // A stored token proves nothing on its own: it may be expired, forged, or
    // signed with a secret this server no longer has. Always re-verify.
    me()
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback((token: string, u: User) => {
    setToken(token);
    setUser(u);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    router.push("/");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
