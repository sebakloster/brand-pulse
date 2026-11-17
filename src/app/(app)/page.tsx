import Link from "next/link";
import { Card } from "@heroui/react";
import { Plus } from "@gravity-ui/icons";
import { BrandLogo } from "@/components/brand-logo";
import { listBrands } from "@/lib/queries";

export const metadata = { title: "Brands · Brand Pulse" };

export default async function Home() {
  const brands = await listBrands();
  return (
    <div className="space-y-8">
      <div className="animate-rise space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your brands</h1>
        <p className="text-sm text-muted">Pick a brand to see what people are saying on Reddit.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {brands.map((b, i) => (
          <Link key={b.id} href={`/b/${b.id}`} className="animate-rise block" style={{ animationDelay: `${60 * (i + 1)}ms` }}>
            <Card className="lift h-full border border-transparent hover:border-border">
              <Card.Header className="flex-row items-center gap-3">
                <BrandLogo name={b.name} domain={b.domain} />
                <div className="min-w-0">
                  <Card.Title className="truncate">{b.name}</Card.Title>
                  <Card.Description className="truncate">{b.domain ?? "No website"}</Card.Description>
                </div>
              </Card.Header>
              <Card.Footer className="text-sm">
                {b.spikes > 0 ? (
                  <span className="flex items-center gap-2 text-danger">
                    <span className="size-2 animate-pulse rounded-full bg-danger" />
                    A thread is blowing up
                  </span>
                ) : b.todo > 0 ? (
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-accent" />
                    {b.todo} to look at
                  </span>
                ) : (
                  <span className="text-muted">All clear</span>
                )}
              </Card.Footer>
            </Card>
          </Link>
        ))}

        <Link href="/new" className="animate-rise block" style={{ animationDelay: `${60 * (brands.length + 1)}ms` }}>
          <div className="lift flex h-full min-h-28 items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed border-border text-sm text-muted hover:text-foreground">
            <Plus className="size-4" /> Add a brand
          </div>
        </Link>
      </div>
    </div>
  );
}
