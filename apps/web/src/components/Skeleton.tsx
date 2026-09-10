/**
 * Loading placeholders shaped like the content that is coming.
 *
 * Replaces the bare "Loading…" strings. Two reasons beyond looks: the layout
 * does not jump when data lands, and a wait with visible structure reads as
 * shorter than the same wait with a word in the middle of an empty page.
 *
 * Every skeleton is aria-hidden with a single polite live region announcing the
 * wait once — a screen reader should hear "Loading your cases", not a stream of
 * meaningless boxes.
 */

export function SkeletonLine({ w = "100%", h = 12 }: { w?: string; h?: number }) {
  return <div className="tt-skeleton" style={{ width: w, height: h }} />;
}

export function CaseCardSkeleton() {
  return (
    <div className="tt-card rounded-xl border border-line p-5" aria-hidden>
      <div className="flex items-center justify-between gap-3">
        <SkeletonLine w="88px" h={14} />
        <SkeletonLine w="72px" h={18} />
      </div>
      <div className="mt-3">
        <SkeletonLine w="46%" h={11} />
      </div>
      <div className="mt-4 flex gap-4">
        <SkeletonLine w="104px" h={10} />
        <SkeletonLine w="120px" h={10} />
      </div>
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="tt-card rounded-xl border border-line p-5" aria-hidden>
      <SkeletonLine w="58%" h={10} />
      <div className="mt-3">
        <SkeletonLine w="40px" h={30} />
      </div>
    </div>
  );
}

export function CaseListSkeleton({ rows = 3, label = "Loading your cases" }: { rows?: number; label?: string }) {
  return (
    <div>
      <span className="sr-only" role="status" aria-live="polite">{label}</span>
      <ul className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i}>
            <CaseCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CaseDetailSkeleton() {
  return (
    <div className="space-y-8">
      <span className="sr-only" role="status" aria-live="polite">Loading this case</span>
      <div aria-hidden className="space-y-3">
        <SkeletonLine w="90px" h={12} />
        <SkeletonLine w="150px" h={28} />
        <SkeletonLine w="62%" h={10} />
        <div className="flex gap-4 pt-2">
          <SkeletonLine w="76px" h={14} />
          <SkeletonLine w="76px" h={14} />
          <SkeletonLine w="76px" h={14} />
        </div>
      </div>
      <div aria-hidden className="tt-card rounded-xl border border-line p-6">
        <SkeletonLine w="52%" h={18} />
        <div className="mt-4 space-y-2.5">
          <SkeletonLine />
          <SkeletonLine w="88%" />
          <SkeletonLine w="64%" />
        </div>
      </div>
    </div>
  );
}
