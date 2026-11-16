import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { SettingsForm } from "@/components/settings-form";
import { getSettings } from "@/lib/email/digest";
import { emailConfigured } from "@/lib/email/send";
import { timeAgo } from "@/lib/labels";

export const metadata = { title: "Settings · Brand Pulse" };

export default async function SettingsPage() {
  const s = await getSettings();
  const alerts = await db.select().from(schema.alerts).orderBy(desc(schema.alerts.sentAt)).limit(5);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl"><span className="text-gradient">Settings</span></h1>
      {!emailConfigured() && (
        <p className="rounded-3xl border border-p2/40 bg-p2/10 p-4 text-sm">
          Email isn&apos;t configured on this deployment (RESEND_API_KEY / EMAIL_FROM), so digests and alerts are recorded but not sent.
        </p>
      )}
      <section className="rounded-3xl border border-border bg-surface p-4 sm:p-6">
        <SettingsForm s={s} />
      </section>
      <section className="space-y-2 rounded-3xl border border-border bg-surface p-4 text-sm sm:p-6">
        <h2 className="font-semibold">Email status</h2>
        <p className="text-muted">
          Last daily digest: {s.lastDigestAt ? `${timeAgo(s.lastDigestAt)}${s.lastDigestDate ? ` (for ${s.lastDigestDate})` : " (test)"}` : "never"}
          {s.lastDigestError && <span className="text-p0"> · last error: {s.lastDigestError}</span>}
        </p>
        <p className="text-muted">Recent spike alerts:</p>
        {alerts.length === 0 ? <p className="text-muted">None.</p> : (
          <ul className="space-y-1">
            {alerts.map((a) => (
              <li key={a.id}>
                {a.kind === "negative_spike" ? "Negative spike" : "Spike"} · raised {timeAgo(a.sentAt)} ·{" "}
                {a.emailedAt ? <span className="text-accent-to">emailed</span> : a.emailError ? <span className="text-p0">not sent: {a.emailError}</span> : <span className="text-p2">pending</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
