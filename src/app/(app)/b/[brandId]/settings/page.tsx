import { notFound } from "next/navigation";
import { Card } from "@heroui/react";
import { BrandForm } from "@/components/brand-form";
import { TrackingPanel } from "@/components/tracking-panel";
import { brandCosts, liveEstimate } from "@/lib/costs";
import { timeAgo } from "@/lib/labels";
import { recentRuns } from "@/lib/pipeline/runs";
import { getBrand } from "@/lib/queries";

const usd = (n: number) => `$${n.toFixed(2)}`;
const STATUS: Record<string, string> = { succeeded: "Done", failed: "Failed", timed_out: "Timed out", running: "Running", starting: "Starting" };

export default async function BrandSettings({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();
  const [costs, estimate, runs] = await Promise.all([brandCosts(), liveEstimate(brandId, brand.pollEveryHours), recentRuns(brandId, 6)]);
  const c = costs.get(brandId);

  return (
    <div className="space-y-6">
      <Card className="animate-rise">
        <Card.Header>
          <Card.Title>Tracking</Card.Title>
          <Card.Description>
            Spent this month: {usd(c?.totalUsd ?? 0)} · about {usd(estimate.perMonth)}/month with automatic checks
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <TrackingPanel brandId={brandId} enabled={brand.enabled} live={brand.livePollingEnabled} pollEveryHours={brand.pollEveryHours} />
        </Card.Content>
      </Card>

      <Card className="animate-rise" style={{ animationDelay: "60ms" }}>
        <Card.Header><Card.Title>Brand details</Card.Title></Card.Header>
        <Card.Content><BrandForm brand={brand} /></Card.Content>
      </Card>

      {runs.length > 0 && (
        <Card className="animate-rise" style={{ animationDelay: "120ms" }}>
          <Card.Header><Card.Title>Recent checks</Card.Title></Card.Header>
          <Card.Content>
            <ul className="divide-y divide-separator text-sm">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <span>{timeAgo(r.startedAt)}</span>
                  <span className="text-muted">{r.purpose === "snapshot" ? "Engagement update" : "Search"}</span>
                  <span className={r.status === "failed" || r.status === "timed_out" ? "text-danger" : "text-muted"}>{STATUS[r.status] ?? r.status}</span>
                  {r.itemsCount != null && <span className="text-muted">{r.itemsCount} items</span>}
                  <span className="ml-auto text-muted">{r.costUsd != null ? usd(r.costUsd) : ""}</span>
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
