import { Card } from "@heroui/react";
import { BrandForm } from "@/components/brand-form";

export const metadata = { title: "Add a brand · Brand Pulse" };

export default function NewBrand() {
  return (
    <div className="space-y-6">
      <div className="animate-rise space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Add a brand</h1>
        <p className="text-sm text-muted">Automatic checks stay off until you turn them on, so adding a brand costs nothing.</p>
      </div>
      <Card className="animate-rise" style={{ animationDelay: "60ms" }}>
        <Card.Content><BrandForm /></Card.Content>
      </Card>
    </div>
  );
}
