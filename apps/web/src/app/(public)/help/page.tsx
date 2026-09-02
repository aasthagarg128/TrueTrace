import SupportResources from "@/components/SupportResources";

export const metadata = { title: "Help & Safety · TrueTrace" };

const FAQ = [
  {
    q: "Do I have to watch the video again?",
    a: "No. TrueTrace retrieves and analyses it for you. One still frame is shown on the case page, blurred by default, and only if you choose to reveal it.",
  },
  {
    q: "Do I have to upload anything?",
    a: "No. You paste a link. The video is fetched, fingerprinted, and deleted. It is never uploaded to cloud storage and never leaves the machine that fetched it.",
  },
  {
    q: "Can I use this without giving my real name?",
    a: "Yes, and that is the intended way. An account is a username and a password. We never ask for an email address, phone number, or identity document.",
  },
  {
    q: "What if the screening says 'not flagged'?",
    a: "That is not a finding that the video is authentic. Automated detection misses a large share of manipulated video, so a non-flag is weak evidence. Every result is shown with its measured error rates.",
  },
  {
    q: "Does my report depend on the detection result?",
    a: "No. Platforms act on your statement that you are the person depicted, not on a detector's opinion. Under the US TAKE IT DOWN Act they must remove non-consensual intimate imagery, including AI-generated depictions, within 48 hours of a valid request.",
  },
  {
    q: "What if TrueTrace cannot retrieve the link?",
    a: "It happens — the content may be private, removed, or behind a login. You can still file a report, and the case page explains how.",
  },
  {
    q: "Someone might see this on my screen.",
    a: "Use Quick exit, top right of every page. It leaves immediately and drops the page from your history so Back will not return to it. Pressing Escape three times does the same. It cannot clear your whole browsing history — for that, use your browser's own history settings or a private window.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Help &amp; Safety</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
          Straight answers about what TrueTrace does, what it cannot do, and how to stay
          safe while using it.
        </p>
      </header>

      <section className="space-y-4">
        {FAQ.map(({ q, a }) => (
          <details key={q} className="tt-card rounded-xl border border-line p-5">
            <summary className="cursor-pointer text-sm font-medium text-ink">{q}</summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </section>

      <SupportResources />
    </div>
  );
}
