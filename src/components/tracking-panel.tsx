"use client";

import { useState, useTransition } from "react";
import { Button, Switch, toast } from "@heroui/react";
import { ArrowsRotateRight } from "@gravity-ui/icons";
import { runNow, setBrandFlag } from "@/app/brand-actions";

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

export function TrackingPanel({ brandId, enabled, live, pollEveryHours, demo }: {
  brandId: string; enabled: boolean; live: boolean; pollEveryHours: number; demo: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <Toggle brandId={brandId} flag="enabled" initial={enabled}>Track this brand</Toggle>
      <Toggle brandId={brandId} flag="livePollingEnabled" initial={live}>Check Reddit automatically every {pollEveryHours} hours</Toggle>
      <Button
        variant="secondary"
        isPending={pending}
        onPress={() => start(async () => {
          const r = await runNow(brandId);
          if (r.ok) toast.success(demo ? "Replaying the saved dataset…" : "Checking Reddit…", { description: "New mentions show up in the inbox in a few minutes." });
          else toast.danger(r.message);
        })}
      >
        <ArrowsRotateRight className="size-4" /> Check Reddit now
      </Button>
    </div>
  );
}
