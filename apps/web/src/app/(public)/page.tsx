import Link from "next/link";
import {
  EvidenceArt,
  HeroArt,
  IconCheck,
  IconClock,
  IconIncognito,
  IconLifebuoy,
  IconLock,
  PipelineArt,
  PlatformMark,
  ReportArt,
  STEP_ICONS,
} from "@/components/Art";
import Reveal from "@/components/Reveal";
import SupportResources from "@/components/SupportResources";

/**
 * The public landing page.
 *
 * Deliberately has NO url input. Submitting a link is the start of a sensitive,
 * private workflow and belongs behind authentication, on /cases/new — the
 * landing page's job is to establish trust and privacy first, then hand over.
 */

const STEPS = [
  { n: "01", title: "Submit", body: "Paste the video link. Nothing is uploaded from your device." },
  { n: "02", title: "Detect", body: "Get an interpretable screening result, with its limits stated." },
  { n: "03", title: "Document", body: "An encrypted, tamper-evident evidence record is created for you." },
  { n: "04", title: "Report", body: "A takedown report is drafted for the platform it is on." },
];

const PRIVACY = [
  { Icon: IconLock, title: "Encrypted evidence", body: "Sealed with AES-256-GCM. Any later alteration is detectable." },
  { Icon: IconIncognito, title: "As private as you want", body: "Sign up with just a username. An email is optional, and only ever used to reset a password." },
  { Icon: IconCheck, title: "No forced re-exposure", body: "You never have to watch the content again to use TrueTrace." },
  { Icon: IconClock, title: "Evidence links expire", body: "Records carry a time-to-live and are not kept indefinitely." },
];

const PLATFORMS = [
  { name: "YouTube", detail: "NCII removal + privacy complaint routes" },
  { name: "Meta", detail: "Facebook, Instagram, Threads + StopNCII" },
  { name: "X", detail: "Non-consensual nudity + statutory route" },
  { name: "TikTok", detail: "Privacy webform + StopNCII" },
];

export default function LandingPage() {
  return (
    <div className="space-y-20">
      {/* ---------------------------------------------------------- hero */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <h1 className="tt-rise text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Protect your likeness.
            <br />
            Document what happened.
            <br />
            <span className="text-accent">Report it with confidence.</span>
          </h1>
          <p className="tt-rise tt-d1 mt-5 max-w-xl text-base leading-relaxed text-muted">
            TrueTrace helps you detect manipulated content, preserve evidence, and
            prepare platform-specific takedown reports.
          </p>

          <div className="tt-rise tt-d2 mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="tt-press tt-focus rounded-lg bg-accent px-6 py-3 text-sm font-medium text-accent-ink shadow-lg shadow-accent/20 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              Get started
            </Link>
            <a
              href="#how-it-works"
              className="tt-press tt-focus rounded-lg border border-line px-6 py-3 text-sm font-medium text-ink transition hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              How it works
            </a>
          </div>

          <ul className="tt-rise tt-d3 mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            <Assurance>Privacy-first</Assurance>
            <Assurance>No real name needed</Assurance>
            <Assurance>No video upload required</Assurance>
          </ul>
        </div>

        <HeroArt className="tt-fade tt-d2 order-first mx-auto h-auto w-full max-w-xs sm:max-w-sm lg:order-last lg:max-w-none" />
      </section>

      {/* -------------------------------------------------- how it works */}
      <Reveal>
        <section id="how-it-works" className="tt-halo scroll-mt-24">
          <h2 className="text-2xl font-semibold tracking-tight">How TrueTrace works</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Four steps, from finding it to filing a report a platform will act on.
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <li key={s.n} className="tt-card tt-lift rounded-xl border border-line p-5">
                  <div className="flex items-center justify-between">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-xs text-subtle">{s.n}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-medium text-ink">{s.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{s.body}</p>
                </li>
              );
            })}
          </ol>
          <PipelineArt className="mt-8 h-auto w-full" />
        </section>
      </Reveal>

      {/* ------------------------------------------------------- privacy */}
      <Reveal>
        <section id="privacy" className="scroll-mt-24">
          <h2 className="text-2xl font-semibold tracking-tight">Your privacy comes first</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            These are not marketing lines. Each one is a property enforced in the code.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {PRIVACY.map(({ Icon, title, body }) => (
              <li key={title} className="tt-card rounded-xl border border-line p-5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-sm font-medium text-ink">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </section>
      </Reveal>

      {/* -------------------------------------------------- what you get */}
      <Reveal>
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">What you end up with</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <article className="tt-card tt-lift flex gap-4 rounded-xl border border-line p-5">
              <EvidenceArt className="h-20 w-20 shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-ink">An evidence record</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Encrypted, timestamped, with a fingerprint of every frame examined.
                  It proves what was there even after the content is taken down.
                </p>
              </div>
            </article>
            <article className="tt-card tt-lift flex gap-4 rounded-xl border border-line p-5">
              <ReportArt className="h-20 w-20 shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-ink">A report ready to send</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Written for the platform it is on, citing the policy and the law that
                  apply, with a link straight to the right reporting form.
                </p>
              </div>
            </article>
          </div>
        </section>
      </Reveal>

      {/* ----------------------------------------------------- platforms */}
      <Reveal>
        <section id="about" className="scroll-mt-24">
          <h2 className="text-2xl font-semibold tracking-tight">Reporting routes we know</h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PLATFORMS.map((pf) => (
              <li key={pf.name} className="tt-card tt-lift rounded-xl border border-line p-4">
                <PlatformMark className="h-6 w-6 text-accent" />
                <h3 className="mt-2 text-sm font-medium text-ink">{pf.name}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{pf.detail}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-subtle">
            Every route was checked against the platform&apos;s own help centre. Anywhere
            else gets a generic report you can send to the site&apos;s abuse contact.
          </p>
        </section>
      </Reveal>

      {/* --------------------------------------------------------- honest */}
      <Reveal>
        <section className="tt-card rounded-xl border border-line p-6">
          <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
            <IconLifebuoy className="h-5 w-5 text-accent" />
            What TrueTrace will not claim
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Automated detection of manipulated video is genuinely hard, and we measured
            ours rather than trusting a model card. It is a screening signal, never a
            verdict, and every result is shown with the error rates behind it. Your
            report does not depend on it: platforms act on your statement that you are
            the person depicted.
          </p>
        </section>
      </Reveal>

      {/* ------------------------------------------------------------ cta */}
      <Reveal>
        <section className="tt-halo rounded-2xl border border-line bg-accent-soft p-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            Ready when you are
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Creating an account takes a username and a password. Nothing else.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="tt-press tt-focus rounded-lg bg-accent px-6 py-3 text-sm font-medium text-accent-ink transition hover:opacity-90"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="tt-press tt-focus rounded-lg border border-line bg-surface px-6 py-3 text-sm font-medium text-ink transition hover:bg-raised"
            >
              I already have an account
            </Link>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <SupportResources />
      </Reveal>
    </div>
  );
}

function Assurance({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <IconCheck className="h-4 w-4 text-accent" />
      {children}
    </li>
  );
}
