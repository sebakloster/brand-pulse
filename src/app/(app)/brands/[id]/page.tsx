import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { BrandForm } from "@/components/brand-form";
import { RunNowButton } from "@/components/brand-controls";
import { brandCosts, liveEstimate } from "@/lib/costs";
import { timeAgo } from "@/lib/labels";
import { apifySpendThisMonth, recentRuns } from "@/lib/pipeline/runs";
import { getRedditSource } from "@/lib/reddit/source";

export const metadata = { title: "Brand · Brand Pulse" };

const usd = (n: number | null | undefined) => (n == null ? "—" : `$${n.toFixed(n < 1 ? 3 : 2)}`);
const STATUS: Record<string, string> = { succeeded: "text-accent-to", failed: "text-p0", timed_out: "text-p0", running: "text-p2", starting: "text-p2" };

export default async function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.id, id));
  if (!brand) notFound();
  const [runs, costs, estimate, [settings], apifyMonth] = await Promise.all([
    recentRuns(id, 12), brandCosts(), liveEstimate(id, brand.pollEveryHours),
    db.select().from(schema.settings).where(eq(schema.settings.id, 1)), apifySpendThisMonth(),
  ]);
  const c = costs.get(id);
  const source = getRedditSource().kind;

  return (
    <div className="space-y-8">
      <Link href="/brands" className="text-sm text-muted hover:text-foreground">← Brands</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{brand.name}</h1>
        <div className="flex flex-wrap items-start gap-3">
          <Link href={`/brands/${id}/overview`} className="rounded-full bg-surface-2 px-5 py-2 text-sm hover:bg-border">Overview & stats</Link>
          <RunNowButton brandId={id} source={source} />
        </div>
      </div>

      <section className="space-y-3 rounded-3xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-semibold">What tracking costs</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted">This month (real)</p>
            <p className="text-lg font-semibold">{usd(c?.totalUsd ?? 0)}</p>
            <p className="text-xs text-muted">
              Scraper {usd(c?.apifyUsd ?? 0)} · AI {usd(c?.claudeUsd ?? 0)}
              {c && Object.keys(c.byPurpose).length > 0 && <> ({Object.entries(c.byPurpose).map(([k, v]) => `${k} ${usd(v)}`).join(", ")})</>}
            </p>
          </div>
          <div>
            <p className="text-muted">If live polling every {brand.pollEveryHours}h</p>
            <p className="text-lg font-semibold">~{usd(estimate.perMonth)}/month</p>
            <p className="text-xs text-muted">Scraper ~{usd(estimate.apifyPerDay)}/day + AI ~{usd(estimate.claudePerDay)}/day ({estimate.basis})</p>
          </div>
          <div>
            <p className="text-muted">Scraper budget (all brands)</p>
            <p className="text-lg font-semibold">{usd(apifyMonth)} of {usd(settings?.monthlyApifyBudgetUsd ?? 5)}</p>
            <p className="text-xs text-muted">Runs are refused once the budget would be exceeded.</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Recent runs</h2>
        {runs.length === 0 ? <p className="text-sm text-muted">No runs yet.</p> : (
          <div className="overflow-x-auto rounded-3xl border border-border">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr><th className="p-3">Started</th><th className="p-3">Kind</th><th className="p-3">Source</th><th className="p-3">Status</th><th className="p-3">Items</th><th className="p-3">Cost</th><th className="p-3">Notes</th></tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3 whitespace-nowrap">{timeAgo(r.startedAt)}{r.manual ? " · manual" : ""}</td>
                    <td className="p-3">{r.purpose}</td>
                    <td className="p-3">{r.source}</td>
                    <td className={`p-3 ${STATUS[r.status] ?? ""}`}>{r.status}</td>
                    <td className="p-3">{r.itemsCount ?? "—"}</td>
                    <td className="p-3">{usd(r.costUsd)}</td>
                    <td className="p-3 text-xs text-muted">{[r.warning, r.error].filter(Boolean).join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-3xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-semibold">Settings</h2>
        <BrandForm brand={brand} />
      </section>
    </div>
  );
}
