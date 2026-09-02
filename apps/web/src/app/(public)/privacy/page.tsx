import Link from "next/link";

export const metadata = { title: "Privacy · TrueTrace" };

const PROPERTIES = [
  {
    title: "The video is never stored",
    body: "It is fetched to a temporary directory, hashed, sampled for still frames, then deleted. It is never uploaded to cloud storage and never sent to a third party.",
  },
  {
    title: "The detector never sees who you are",
    body: "Only the sampled frames reach it. It receives no URL, no case id, and no account identifier, so the most sensitive material in the system travels as far as possible from anything identifying.",
  },
  {
    title: "We collect no contact details",
    body: "An account is a username and a password. No email, phone number, real name, date of birth, or identity document is requested or stored. This is also why a lost password cannot be recovered.",
  },
  {
    title: "Passwords are unreadable, including to us",
    body: "Stored as a scrypt hash with a per-account salt. There is no way to recover the original password from what we hold.",
  },
  {
    title: "Evidence is encrypted and expires",
    body: "Records are sealed with AES-256-GCM. The manifest hash is bound into the encryption, so a package cannot be re-pointed at different contents without detection. Records carry a time-to-live rather than being kept indefinitely.",
  },
  {
    title: "Your cases are yours alone",
    body: "Every case belongs to exactly one account. A request for someone else's case returns 'not found' rather than 'forbidden', so the existence of a case is never confirmed to anyone but its owner.",
  },
  {
    title: "No third-party requests",
    body: "The interface loads no external fonts, scripts, analytics, or images. Every illustration is drawn inline. Visiting TrueTrace does not tell anyone else that you did.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
          What follows is a description of how the software actually behaves, not a
          statement of intent. Each item corresponds to something enforced in code.
        </p>
      </header>

      <section className="space-y-4">
        {PROPERTIES.map(({ title, body }) => (
          <article key={title} className="tt-card rounded-xl border border-line p-5">
            <h2 className="text-sm font-medium text-ink">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
          </article>
        ))}
      </section>

      <section className="tt-card rounded-xl border border-line p-6">
        <h2 className="text-lg font-medium">Limits you should know about</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          <li>
            Quick exit leaves the page and drops it from your history, but no web page
            can clear your whole browsing history. Use a private window if that matters.
          </li>
          <li>
            Retrieving a link means our server contacts the hosting platform. That
            platform can see the request, though it learns nothing about you from it.
          </li>
          <li>
            Automated detection is a screening signal, never a verdict. Measured error
            rates are shown with every result rather than hidden.
          </li>
          <li>
            TrueTrace provides information, not legal advice.
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted">
          Questions about staying safe are answered on the{" "}
          <Link href="/help" className="text-accent underline underline-offset-2">
            Help &amp; Safety
          </Link>{" "}
          page.
        </p>
      </section>
    </div>
  );
}
