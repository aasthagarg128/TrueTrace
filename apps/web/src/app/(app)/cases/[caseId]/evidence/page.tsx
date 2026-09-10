"use client";

import { use } from "react";
import { EvidenceArt, IconClock } from "@/components/Art";
import CaseHeader from "@/components/CaseHeader";
import { CaseDetailSkeleton } from "@/components/Skeleton";
import { timeUntil } from "@/lib/api";
import { useCase } from "@/lib/useCase";

export default function EvidencePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = use(params);
  const { kase, error } = useCase(caseId);

  if (error) return <Notice title="Could not load this case" body={error} />;
  if (!kase) return <CaseDetailSkeleton />;

  const ev = kase.evidence;

  return (
    <div className="space-y-8">
      <CaseHeader kase={kase} />

      {!ev ? (
        <Notice
          title="No evidence record yet"
          body={
            kase.status === "failed"
              ? "The content could not be retrieved, so nothing was sealed."
              : "The record is sealed once analysis finishes."
          }
        />
      ) : ev.expired ? (
        /* The archive has been deleted on schedule. Say so plainly, and be
           clear about what survives — the hashes are the evidentiary claim and
           they are still here. */
        <section className="tt-card rounded-xl border border-line p-6">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <IconClock className="h-5 w-5 text-attention" />
            This evidence record has expired
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            The sealed archive was deleted on{" "}
            {ev.expired_at ? new Date(ev.expired_at).toLocaleDateString() : "its expiry date"},
            as promised when it was created. The frames it contained are gone.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            The fingerprints below survive, and they are the part that carries
            evidentiary weight: they let you state that a file with this exact
            content existed at this exact time. They reveal nothing about the video.
          </p>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <Row label="Content fingerprint (SHA-256)" value={ev.video_sha256} mono />
            <Row label="Evidence manifest (SHA-256)" value={ev.manifest_sha256} mono />
            <Row label="Originally recorded" value={new Date(ev.fetched_at).toLocaleString()} />
            <Row label="Frames examined" value={String(ev.frame_count)} />
          </dl>

          <p className="mt-6 text-xs leading-relaxed text-subtle">
            If you need a fresh sealed record of the same content, start a new case
            with the same link — provided it is still online.
          </p>
        </section>
      ) : (
        <>
          <section className="tt-card rounded-xl border border-line p-6">
            <div className="flex gap-5">
              <EvidenceArt className="hidden h-24 w-24 shrink-0 sm:block" />
              <div>
                <h2 className="text-lg font-medium">Evidence record</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                  Encrypted with AES-256-GCM and sealed. Every frame carries its own
                  fingerprint, so any later alteration is detectable. This matters
                  because content often disappears once it is reported — this proves
                  what was there, and when.
                </p>
              </div>
            </div>

            {ev.expires_at && (
              <p className="mt-5 flex items-center gap-2 rounded-lg bg-raised px-3 py-2.5 text-sm text-muted">
                <IconClock className="h-4 w-4 shrink-0 text-accent" />
                <span>
                  {timeUntil(ev.expires_at)
                    ? <>Deleted automatically in <strong className="text-ink">{timeUntil(ev.expires_at)}</strong>{" "}
                       ({new Date(ev.expires_at).toLocaleString()}). Download anything you need before then.</>
                    : <>Due for deletion. It will be removed at the next sweep.</>}
                </span>
              </p>
            )}

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <Row label="Content fingerprint (SHA-256)" value={ev.video_sha256} mono />
              <Row label="Evidence manifest (SHA-256)" value={ev.manifest_sha256} mono />
              <Row label="Recorded" value={new Date(ev.fetched_at).toLocaleString()} />
              {ev.sealed_at && <Row label="Sealed" value={new Date(ev.sealed_at).toLocaleString()} />}
              <Row label="Frames sealed" value={String(ev.frame_count)} />
              {ev.size_bytes != null && (
                <Row label="Size" value={`${Math.round(ev.size_bytes / 1024)} KB`} />
              )}
            </dl>
          </section>

          <section className="tt-card rounded-xl border border-line p-6">
            <h2 className="text-lg font-medium">Verifying this record</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Anyone holding the record and its key can re-check every hash
              independently — that is what makes it evidence rather than a claim.
              Verification is a separate tool, so it does not have to trust the app
              that produced the package.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-raised p-4 text-xs text-muted">
{`python -m truetrace.core.verify \\
  --package data/evidence/${kase.case_id}.ttz`}
            </pre>
            <p className="mt-3 text-xs text-subtle">
              A single altered bit causes verification to fail rather than quietly
              returning wrong contents.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className={`mt-0.5 break-all text-xs text-muted ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <section className="tt-card rounded-xl border border-line p-6">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </section>
  );
}
