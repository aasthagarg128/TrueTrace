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
    title: "Contact details are optional, and that is your choice",
    body: "You can sign up with a username and password alone, in which case we hold no way to contact you at all. You can instead add an email address, which is stored and used for exactly one thing: resetting a forgotten password. Either way we never ask for your real name, phone number, date of birth, or any identity document. The signup page states the trade-off on each option rather than burying it here.",
  },
  {
    title: "Email addresses are not listed anywhere",
    body: "When an address is stored it is indexed by a hash, so the filenames on disk are not a list of everyone's email address. The address itself lives only inside the account record, and deleting the account removes it.",
  },
  {
    title: "Password reset links are short-lived and single-use",
    body: "A link expires in 30 minutes and stops working the instant the password changes, so an old link found in an inbox is already dead. Requesting a reset returns the same response whether or not the address has an account, so the form cannot be used to check whether someone uses TrueTrace.",
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
    title: "No third-party requests, unless you choose Google",
    body: "The interface loads no external fonts, scripts, analytics, or images, and every illustration is drawn inline. The one exception is Google Sign-In: its script loads only on the login and sign-up screens, and only when that option is enabled. If you sign in with a username, nothing on any page ever contacts Google.",
  },
  {
    title: "Google Sign-In stores no personal data here",
    body: "Google returns your name, email address and profile picture. We discard all of it and keep only the opaque account identifier, so a Google-linked account is no more identifying to TrueTrace than a pseudonymous one. What it does cost you is anonymity toward Google, who will know you use this service. A username and password avoids that entirely, and remains the recommended choice.",
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
            Choosing Google Sign-In tells Google that you use TrueTrace. We cannot
            prevent that, which is why it is offered as a secondary option rather
            than the default.
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
