"use client";

import { useState, useTransition } from "react";
import { Button, ToggleButton, ToggleButtonGroup, toast } from "@heroui/react";
import { setBrandFlag, setSchedule } from "@/app/brand-actions";

const OPTIONS: { hours: number | null; label: string }[] = [
  { hours: null, label: "Off" },
  { hours: 6, label: "Every 6 hours" },
  { hours: 12, label: "Every 12 hours" },
  { hours: 24, label: "Daily" },
];

const keyOf = (hours: number | null) => (hours === null ? "off" : String(hours));

/** How often Reddit is checked without anyone clicking. */
export function AutomaticChecks({ brandId, current, paused, estimates }: {
  brandId: string; current: number | null; paused: boolean;
  estimates: Record<number, { perCheck: number; perMonth: number }>;
}) {
  const [value, setValue] = useState<number | null>(current);
  const [, start] = useTransition();
  function choose(hours: number | null) {
    const before = value;
    setValue(hours);
    start(async () => {
      try { await setSchedule(brandId, hours); }
      catch { setValue(before); toast.danger("Couldn't save that setting."); }
    });
  }
  return (
    <div className="space-y-3">
      <ToggleButtonGroup
        aria-label="Automatic checks"
        selectionMode="single"
        disallowEmptySelection
        size="sm"
        isDisabled={paused}
        selectedKeys={[keyOf(value)]}
        onSelectionChange={(keys) => {
          const k = [...keys][0];
          if (k !== undefined) choose(k === "off" ? null : Number(k));
        }}
        className="flex-wrap"
      >
        {OPTIONS.map((o, i) => (
          <ToggleButton key={o.label} id={keyOf(o.hours)}>
            {i > 0 && <ToggleButtonGroup.Separator />}
            {o.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <p className="text-sm text-muted">
        {paused
          ? "Paused brands are never checked."
          : value === null
            ? "Reddit is only checked when you click “Check Reddit now” in the inbox."
            : `About $${estimates[value].perCheck.toFixed(2)} per check · about $${Math.round(estimates[value].perMonth)}/month including analysis.`}
      </p>
    </div>
  );
}

/** Pausing stops everything for a brand: checks, analysis, alerts and emails. */
export function PauseBrand({ brandId, enabled }: { brandId: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-md text-sm text-muted">
        {on
          ? "Stops all checks, analysis, alerts and emails for this brand. Nothing is deleted."
          : "This brand is paused. Nothing is checked or analyzed until you resume it."}
      </p>
      <Button
        variant={on ? "danger-soft" : "primary"}
        isPending={pending}
        onPress={() => start(async () => {
          try {
            await setBrandFlag(brandId, "enabled", !on);
            setOn(!on);
            toast.success(on ? "Brand paused" : "Brand resumed");
          } catch { toast.danger("Couldn't save that setting."); }
        })}
      >
        {on ? "Pause brand" : "Resume brand"}
      </Button>
    </div>
  );
}
