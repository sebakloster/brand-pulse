"use client";

import { useState, useTransition } from "react";
import { ToggleButton, ToggleButtonGroup, toast } from "@heroui/react";
import { setSchedule } from "@/app/brand-actions";

const OPTIONS: { hours: number | null; label: string }[] = [
  { hours: null, label: "Off" },
  { hours: 6, label: "Every 6 hours" },
  { hours: 12, label: "Every 12 hours" },
  { hours: 24, label: "Daily" },
];

const keyOf = (hours: number | null) => (hours === null ? "off" : String(hours));

/** How often Reddit is checked without anyone clicking. */
export function AutomaticChecks({ brandId, current, estimates }: {
  brandId: string; current: number | null;
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
        {value === null
          ? "Reddit is only checked when you click “Check Reddit now” in the inbox."
          : `About $${estimates[value].perCheck.toFixed(2)} per check · about $${Math.round(estimates[value].perMonth)}/month including analysis.`}
      </p>
    </div>
  );
}
