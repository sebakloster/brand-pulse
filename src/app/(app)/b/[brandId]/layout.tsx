import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "@gravity-ui/icons";
import { BrandLogo } from "@/components/brand-logo";
import { BrandTabs } from "@/components/brand-tabs";
import { getBrand } from "@/lib/queries";

export default async function BrandLayout({ children, params }: { children: React.ReactNode; params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();
  return (
    <div className="space-y-6">
      <div className="animate-rise flex items-center gap-3">
        <Link href="/" aria-label="All brands" className="-ml-2 rounded-full p-2 text-muted transition-colors hover:bg-surface hover:text-foreground">
          <ChevronLeft className="size-4" />
        </Link>
        <BrandLogo name={brand.name} domain={brand.domain} size="sm" />
        <h1 className="text-xl font-semibold tracking-tight">{brand.name}</h1>
        {!brand.enabled && <span className="text-sm text-muted">· paused</span>}
      </div>
      <BrandTabs brandId={brandId} />
      <div>{children}</div>
    </div>
  );
}
