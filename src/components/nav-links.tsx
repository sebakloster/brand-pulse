"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const LINKS = [
  { href: "/queue", label: "Queue", match: (p: string, tab: string | null) => p.startsWith("/queue") && tab !== "followed" },
  { href: "/queue?tab=followed", label: "Followed", match: (p: string, tab: string | null) => p.startsWith("/queue") && tab === "followed" },
  { href: "/brands", label: "Brands", match: (p: string) => p.startsWith("/brands") },
];

export function NavLinks({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  return LINKS.map((l) => {
    const active = l.match(pathname, tab);
    return variant === "top" ? (
      <Link
        key={l.href}
        href={l.href}
        className={`rounded-full px-4 py-1.5 text-sm ${active ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"}`}
      >
        {l.label}
      </Link>
    ) : (
      <Link
        key={l.href}
        href={l.href}
        className={`flex-1 py-3 text-center text-sm ${active ? "text-foreground" : "text-muted"}`}
      >
        <span className={active ? "text-gradient font-medium" : ""}>{l.label}</span>
      </Link>
    );
  });
}
