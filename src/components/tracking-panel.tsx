"use client";

import { useState, useTransition } from "react";
import { Switch, toast } from "@heroui/react";
import { setBrandFlag } from "@/app/brand-actions";

function Toggle({ brandId, flag, initial, children }: { brandId: string; flag: "enabled" | "livePollingEnabled"; initial: boolean; children: React.ReactNode }) {
  const [on, setOn] = useState(initial);
  const [, start] = useTransition();
  return (
    <Switch
      isSelected={on}
      onChange={(next: boolean) => {
        setOn(next);
        start(async () => {
          try { await setBrandFlag(brandId, flag, next); }
          catch { setOn(!next); toast.danger("Couldn't save that setting."); }
        });
      }}
    >
      <Switch.Content>
        <Switch.Control><Switch.Thumb /></Switch.Control>
        <span className="text-sm">{children}</span>
      </Switch.Content>
    </Switch>
  );
}

export function TrackingPanel({ brandId, enabled, live, pollEveryHours }: {
  brandId: string; enabled: boolean; live: boolean; pollEveryHours: number;
}) {
  return (
    <div className="space-y-4">
      <Toggle brandId={brandId} flag="enabled" initial={enabled}>Track this brand</Toggle>
      <Toggle brandId={brandId} flag="livePollingEnabled" initial={live}>Check Reddit automatically every {pollEveryHours} hours</Toggle>
    </div>
  );
}
