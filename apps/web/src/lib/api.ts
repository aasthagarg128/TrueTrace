const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080";

/* ------------------------------------------------------------------ types */

export type Band = "inconclusive" | "flagged" | "not_flagged";

export type CaseStatus =
  | "queued" | "fetching" | "hashing" | "sampling" | "verifying_identity"
  | "screening" | "sealing" | "complete" | "failed";

export interface IdentityCheck {
  matched: boolean;
  reason: string | null;
  best_similarity: number | null;
  threshold?: number;
  frames_with_face?: number;
}

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
  /** Gemini prose, when configured. The template limitations are shown regardless. */
  explanation?: string;
  explanation_source?: "gemini";
}

export interface Evidence {
  /** Absent once the package has been swept. */
  path?: string;
  size_bytes?: number;
  manifest_sha256: string;
  video_sha256: string;
  fetched_at: string;
  sealed_at?: string;
  expires_at?: string;
  frame_count: number;
  /** Set by the retention sweep. The archive is gone; the hashes remain. */
  expired?: boolean;
  expired_at?: string;
  swept_at?: string;
}

export interface AuditEntry { at: string; action: string; detail: string }

export interface Case {
  case_id: string;
  owner: string;
  status: CaseStatus;
  source_url: string;
  created_at: string;
  analysis: Analysis | null;
  evidence: Evidence | null;
  preview_b64: string | null;
  source_metadata?: Record<string, unknown>;
  audit: AuditEntry[];
  error: string | null;
  /** Present once the identity gate has run, matched or not. */
  identity_check?: IdentityCheck | null;
  /** Set whenever status is "failed", so the UI can explain WHY rather than
   * showing one generic message for every kind of failure. */
  failure_reason?:
    | "fetch" | "no_frames" | "identity_mismatch" | "identity_no_face_in_reference"
    | "identity_no_face_in_video_frames" | "identity_check_unavailable" | "unexpected"
    | null;
}

export interface CaseSummary {
  case_id: string;
  status: CaseStatus;
  source_url: string;
  created_at: string;
  band: Band | null;
}

export interface Route { name: string; url: string; note: string }

export interface Report {
  platform: string | null;
  subject: string;
  body: string;
  routes: Route[];
  checklist: string[];
  warnings: string[];
}

export interface User {
  user_id: string;
  username: string;
  created_at: string;
  auth_provider?: "password" | "google";
  /** Present only when the account was created with the recoverable option. */
  email?: string | null;
  recoverable?: boolean;
}

export interface AuthConfig {
  google_enabled: boolean;
  google_client_id: string | null;
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
  /** Required. Compared once, in memory, against faces in the video; never
   * uploaded anywhere else and never stored after that comparison. */
  referencePhoto: File;
}

/* ------------------------------------------------------------- token store */

const TOKEN_KEY = "truetrace.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: the session simply will not persist */
  }
}

/* --------------------------------------------------------------- requests */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  // FormData bodies must NOT get a manual Content-Type: the browser sets one
  // itself, including the multipart boundary, and overriding it here would
  // send a boundary-less header the server can't parse.
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ auth */

/** `email` is optional: omitting it creates an account with no contact details. */
export async function signup(username: string, password: string, email?: string | null) {
  return request<{ token: string; user: User }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, password, email: email || null }),
  });
}

export async function forgotPassword(email: string) {
  return request<{ sent: boolean; detail: string }>("/auth/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string) {
  return request<{ token: string; user: User }>("/auth/reset", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function login(username: string, password: string) {
  return request<{ token: string; user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function authConfig() {
  return request<AuthConfig>("/auth/config");
}

/** Exchange a Google ID token for a TrueTrace session. */
export async function googleLogin(credential: string) {
  return request<{ token: string; user: User; created: boolean }>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

export async function me() {
  return request<User>("/auth/me");
}

export async function deleteAccount() {
  return request<void>("/account", { method: "DELETE" });
}

/* ----------------------------------------------------------------- cases */

export async function createCase(body: CreateCaseBody) {
  // multipart/form-data, not JSON: the reference photo has to travel in the
  // same request as the rest of the intake, and a JSON body can't carry a
  // file. See lib/api.ts `request()` for why Content-Type is left unset here.
  const form = new FormData();
  form.set("url", body.url);
  form.set("depicts_reporter", body.depicts_reporter ? "true" : "false");
  form.set("consent_given", body.consent_given ? "true" : "false");
  form.set("is_intimate", body.is_intimate ? "true" : "false");
  form.set("jurisdiction", body.jurisdiction);
  if (body.reporter_name) form.set("reporter_name", body.reporter_name);
  if (body.reporter_contact) form.set("reporter_contact", body.reporter_contact);
  if (body.extra_context) form.set("extra_context", body.extra_context);
  form.set("reference_photo", body.referencePhoto);

  return request<{ case_id: string; status: string }>("/cases", {
    method: "POST",
    body: form,
  });
}

export async function listCases() {
  return request<CaseSummary[]>("/cases");
}

export async function getCase(id: string) {
  return request<Case>(`/cases/${encodeURIComponent(id)}`);
}

export async function getReport(id: string) {
  return request<Report>(`/cases/${encodeURIComponent(id)}/report`);
}

export async function health() {
  return request<{ status: string; detector: Record<string, unknown> }>("/healthz");
}

/* -------------------------------------------------------------- feedback */

/** No login required — the token is attached automatically if one exists,
 * but its absence never blocks the submission. */
export async function sendFeedback(input: {
  message: string;
  rating?: number | null;
  contact?: string | null;
  page?: string;
}) {
  return request<{ feedback_id: string }>("/feedback", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/* --------------------------------------------------------------- helpers */

export const BUSY_STATUSES: CaseStatus[] = [
  "queued", "fetching", "hashing", "sampling", "verifying_identity", "screening", "sealing",
];

export function isBusy(status: CaseStatus) {
  return BUSY_STATUSES.includes(status);
}

/** Plain-language time remaining: "3 days", "4 hours", "under an hour". */
export function timeUntil(iso: string): string | null {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return null;
  const hours = ms / 36e5;
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${Math.round(hours)} hours`;
  return `${Math.round(hours / 24)} days`;
}

/** Short, human-facing case reference: case-8f29a1b2c3d4 -> TR-8F29 */
export function shortRef(caseId: string) {
  const tail = caseId.replace(/^case-/, "").slice(0, 4).toUpperCase();
  return `TR-${tail}`;
}
