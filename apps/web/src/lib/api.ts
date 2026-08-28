const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080";

export type Band = "inconclusive" | "flagged" | "not_flagged";

export interface FrameResult {
  index: number;
  scored: boolean;
  score: number | null;
  face_confidence: number | null;
  reason: string | null;
}

export interface Analysis {
  band: Band;
  score: number | null;
  frames_submitted: number;
  frames_with_face: number;
  frames_scored: number;
  flagged_fraction: number | null;
  dispersion: number | null;
  limitations: string[];
  frames: FrameResult[];
  model_version: string;
  elapsed_ms: number;
}

export interface Evidence {
  path: string;
  size_bytes: number;
  manifest_sha256: string;
  video_sha256: string;
  fetched_at: string;
  sealed_at: string;
  expires_at: string;
  frame_count: number;
}

export interface AuditEntry {
  at: string;
  action: string;
  detail: string;
}

export interface Case {
  case_id: string;
  owner: string;
  status: "queued" | "fetching" | "hashing" | "sampling" | "screening" | "sealing" | "complete" | "failed";
  source_url: string;
  created_at: string;
  analysis: Analysis | null;
  evidence: Evidence | null;
  preview_b64: string | null;
  source_metadata?: Record<string, unknown>;
  audit: AuditEntry[];
  error: string | null;
}

export interface Route {
  name: string;
  url: string;
  note: string;
}

export interface Report {
  platform: string | null;
  subject: string;
  body: string;
  routes: Route[];
  checklist: string[];
  warnings: string[];
}

export interface CreateCaseBody {
  url: string;
  depicts_reporter: boolean;
  consent_given: boolean;
  is_intimate: boolean;
  jurisdiction: string;
  reporter_name: string | null;
  reporter_contact: string | null;
  extra_context: string | null;
  owner: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function createCase(body: CreateCaseBody) {
  return json<{ case_id: string; status: string }>(
    await fetch(`${BASE}/cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function getCase(id: string) {
  return json<Case>(await fetch(`${BASE}/cases/${id}`, { cache: "no-store" }));
}

export async function getReport(id: string) {
  return json<Report>(await fetch(`${BASE}/cases/${id}/report`, { cache: "no-store" }));
}

export async function health() {
  return json<{ status: string; detector: Record<string, unknown> }>(
    await fetch(`${BASE}/healthz`, { cache: "no-store" }),
  );
}

/**
 * A pseudonymous, client-generated identifier. No email, no profile, no sign-up.
 * Kept in localStorage so a person can return to their cases; it never leaves
 * this browser except as an opaque string on their own cases.
 */
export function ownerId(): string {
  if (typeof window === "undefined") return "anonymous";
  try {
    const k = "truetrace.owner";
    let v = window.localStorage.getItem(k);
    if (!v) {
      v = crypto.randomUUID();
      window.localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "anonymous";
  }
}
