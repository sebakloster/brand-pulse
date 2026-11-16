export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Hear about it <span className="text-gradient">first</span>.
      </h1>
      <p className="text-muted">
        Reddit brand monitoring: finds mentions, shows how people feel and what needs attention,
        and drafts replies in the brand&apos;s voice for a human to approve.
      </p>
      <div className="flex gap-3">
        <span className="bg-gradient-accent rounded-full px-5 py-2 text-sm font-medium text-black">
          Coming soon
        </span>
        <span className="rounded-full bg-surface-2 px-5 py-2 text-sm text-muted">Reddit brand monitoring</span>
      </div>
    </main>
  );
}
