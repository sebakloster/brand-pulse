import { notFound } from "next/navigation";
import { Card } from "@heroui/react";
import { BrandForm } from "@/components/brand-form";
import { DeleteBrand } from "@/components/delete-brand";
import { AutomaticChecks } from "@/components/tracking-panel";
import { brandCosts, scheduleEstimates } from "@/lib/costs";
import { timeAgo } from "@/lib/labels";
import { recentRuns } from "@/lib/pipeline/runs";
import { getBrand } from "@/lib/queries";

const usd = (n: number) => `$${n.toFixed(2)}`;
const STATUS: Record<string, string> = { succeeded: "Done", failed: "Failed", timed_out: "Timed out", running: "Running", starting: "Starting" };

export default async function BrandSettings({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();
  const [costs, estimates, runs] = await Promise.all([brandCosts(), scheduleEstimates(brandId), recentRuns(brandId, 6)]);
  const c = costs.get(brandId);

  return (
    <div className="space-y-6">
      <Card className="animate-rise">
        <Card.Header>
          <Card.Title>Automatic checks</Card.Title>
          <Card.Description>Spent on this brand this month: {usd(c?.totalUsd ?? 0)}</Card.Description>
        </Card.Header>
        <Card.Content>
          <AutomaticChecks
            brandId={brandId}
            current={brand.livePollingEnabled ? brand.pollEveryHours : null}
            estimates={estimates}
          />
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
                  <span className="text-muted">{r.purpose === "snapshot" ? "Engagement update" : r.manual ? "Manual check" : "Automatic check"}</span>
                  <span className={r.status === "failed" || r.status === "timed_out" ? "text-danger" : "text-muted"}>{STATUS[r.status] ?? r.status}</span>
                  {r.itemsCount != null && <span className="text-muted">{r.itemsCount} items</span>}
                  <span className="ml-auto text-muted">{r.costUsd != null ? usd(r.costUsd) : ""}</span>
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      )}

      <Card className="animate-rise" style={{ animationDelay: "180ms" }}>
        <Card.Header><Card.Title>Delete brand</Card.Title></Card.Header>
        <Card.Content>
          <DeleteBrand brandId={brandId} name={brand.name} />
        </Card.Content>
      </Card>
    </div>
  );
}
