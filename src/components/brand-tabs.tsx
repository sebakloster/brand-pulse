"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs } from "@heroui/react";

export function BrandTabs({ brandId }: { brandId: string }) {
  const path = usePathname();
  const base = `/b/${brandId}`;
  const tabs = [
    { id: "inbox", label: "Inbox", href: base },
    { id: "insights", label: "Insights", href: `${base}/insights` },
    { id: "settings", label: "Settings", href: `${base}/settings` },
  ];
  // Inside a single mention the page has its own "‹ Inbox" link; tabs would be a second way back.
  if (path.startsWith(`${base}/m/`)) return null;
  const selected = path.startsWith(`${base}/insights`) ? "insights" : path.startsWith(`${base}/settings`) ? "settings" : "inbox";
  return (
    <Tabs selectedKey={selected} variant="secondary" className="w-full">
      <Tabs.ListContainer>
        <Tabs.List aria-label="Brand sections">
          {tabs.map((t) => (
            <Tabs.Tab key={t.id} id={t.id} href={t.href} render={(props: object) => <Link {...(props as { href: string })} />}>
              {t.label}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}
