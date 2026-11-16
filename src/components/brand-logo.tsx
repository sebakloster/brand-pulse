import { Avatar } from "@heroui/react";
import { logoUrl } from "@/lib/labels";

export function BrandLogo({ name, domain, size = "md" }: { name: string; domain: string | null; size?: "sm" | "md" | "lg" }) {
  const src = logoUrl(domain);
  return (
    <Avatar size={size} className="shrink-0 bg-white">
      {src && <Avatar.Image alt={`${name} logo`} src={src} />}
      <Avatar.Fallback className="font-semibold">{name.slice(0, 1).toUpperCase()}</Avatar.Fallback>
    </Avatar>
  );
}
