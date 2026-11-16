import Link from "next/link";
import { BrandForm } from "@/components/brand-form";

export const metadata = { title: "Add brand · Brand Pulse" };

export default function NewBrandPage() {
  return (
    <div className="space-y-6">
      <Link href="/brands" className="text-sm text-muted hover:text-foreground">← Brands</Link>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Add a <span className="text-gradient">brand</span></h1>
      <p className="text-sm text-muted">
        Tracking starts on the next run. Live polling stays off until you turn it on, so adding a brand costs nothing.
      </p>
      <section className="rounded-3xl border border-border bg-surface p-4 sm:p-6"><BrandForm /></section>
    </div>
  );
}
