"use client";

import { useCallback, useEffect, useState } from "react";
import { getCase, isBusy, type Case } from "./api";

/**
 * Fetch a case and keep polling while the pipeline is still working.
 *
 * Polling rather than websockets: it behaves identically locally and deployed,
 * survives a dropped connection without reconnect logic, and is one less moving
 * part to fail during a demo.
 */
export function useCase(caseId: string) {
  const [kase, setCase] = useState<Case | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!caseId) return null;
    try {
      const c = await getCase(caseId);
      setCase(c);
      setError(null);
      return c;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [caseId]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      const c = await load();
      if (!alive) return;
      if (c && isBusy(c.status)) timer = setTimeout(tick, 1500);
    };
    tick();

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [load]);

  return { kase, error, reload: load };
}
