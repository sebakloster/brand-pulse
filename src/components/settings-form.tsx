"use client";

import { useActionState, useTransition, useState } from "react";
import { saveSettings, sendTestDigest, type SettingsState } from "@/app/settings-actions";

const input = "w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-accent-from";

export function SettingsForm({ s }: { s: { emailRecipients: string[]; timezone: string; digestHour: number; monthlyApifyBudgetUsd: number; spikeEmails: boolean } }) {
  const [state, action, pending] = useActionState<SettingsState | undefined, FormData>(saveSettings, undefined);
  const [test, setTest] = useState<SettingsState | null>(null);
  const v = state?.values; // last submitted values after an error
  const [testing, start] = useTransition();
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email recipients</span>
          <span className="block text-xs text-muted">The daily digest and spike alerts go to everyone here. One per line or comma separated.</span>
          <textarea name="emailRecipients" defaultValue={v?.emailRecipients ?? s.emailRecipients.join("\n")} rows={3} className={input} />
        </label>
        <div className="grid gap-5 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Time zone</span>
            <input name="timezone" defaultValue={v?.timezone ?? s.timezone} className={input} placeholder="America/New_York" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Digest hour (local)</span>
            <input name="digestHour" type="number" min={0} max={23} defaultValue={v?.digestHour ?? s.digestHour} className={input} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Monthly scraper budget ($)</span>
            <input name="monthlyApifyBudgetUsd" type="number" min={0} step="0.5" defaultValue={v?.monthlyApifyBudgetUsd ?? s.monthlyApifyBudgetUsd} className={input} />
          </label>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="spikeEmails" defaultChecked={v ? v.spikeEmails === "on" : s.spikeEmails} className="h-4 w-4 accent-[#3b82f6]" />
          Email me right away when a thread spikes
        </label>
        <div className="flex items-center gap-3">
          <button disabled={pending} className="bg-gradient-accent rounded-full px-6 py-2.5 text-sm font-medium text-black disabled:opacity-60">
            {pending ? "Saving…" : "Save settings"}
          </button>
          {state?.error && <p className="text-sm text-p0">{state.error}</p>}
          {state?.saved && <p className="text-sm text-accent-to">Saved.</p>}
        </div>
      </form>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <button
          disabled={testing}
          onClick={() => start(async () => setTest(await sendTestDigest()))}
          className="rounded-full bg-surface-2 px-5 py-2 text-sm hover:bg-border disabled:opacity-60"
        >
          {testing ? "Sending…" : "Send test digest now"}
        </button>
        {test?.error && <p className="text-sm text-p0">{test.error}</p>}
        {test?.message && <p className="text-sm text-accent-to">{test.message}</p>}
      </div>
    </div>
  );
}
