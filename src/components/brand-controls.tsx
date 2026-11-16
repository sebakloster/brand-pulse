"use client";

import { useState, useTransition } from "react";
import { runNow, setBrandFlag } from "@/app/brand-actions";

export function Toggle({ brandId, flag, initial, label, hint }: {
  brandId: string; flag: "enabled" | "livePollingEnabled"; initial: boolean; label: string; hint?: string;
}) {
  const [on, setOn] = useState(initial);
  const [err, setErr] = useState(false);
  const [, start] = useTransition();
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm" title={hint}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => {
          const next = !on; setOn(next); setErr(false);
          start(async () => { try { await setBrandFlag(brandId, flag, next); } catch { setOn(!next); setErr(true); } });
        }}
        className={`relative h-6 w-11 rounded-full transition ${on ? "bg-gradient-accent" : "bg-surface-2"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
      <span>{label}{err && <span className="ml-2 text-p0">(not saved)</span>}</span>
    </label>
  );
}

export function RunNowButton({ brandId, source }: { brandId: string; source: "apify" | "fixture" }) {
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <button
        disabled={pending}
        onClick={() => start(async () => setMsg(await runNow(brandId)))}
        className="bg-gradient-accent rounded-full px-5 py-2 text-sm font-medium text-black disabled:opacity-60"
      >
        {pending ? "Starting…" : source === "apify" ? "Run now (live)" : "Run now (demo data)"}
      </button>
      {msg && <p className={`text-sm ${msg.ok ? "text-muted" : "text-p0"}`}>{msg.message}</p>}
    </div>
  );
}
