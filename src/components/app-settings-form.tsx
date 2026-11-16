"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button, Description, Input, Label, Switch, TextArea, TextField, toast } from "@heroui/react";
import { saveSettings, sendTestDigest, type SettingsState } from "@/app/settings-actions";

type S = { emailRecipients: string[]; timezone: string; digestHour: number; monthlyApifyBudgetUsd: number; spikeEmails: boolean };

export function AppSettingsForm({ s }: { s: S }) {
  const [state, action, pending] = useActionState<SettingsState | undefined, FormData>(saveSettings, undefined);
  const [testing, start] = useTransition();
  const [spike, setSpike] = useState(s.spikeEmails);
  const v = state?.values;

  useEffect(() => {
    if (state?.saved) toast.success("Settings saved");
    if (state?.error) toast.danger(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-5">
      <TextField name="emailRecipients" defaultValue={v?.emailRecipients ?? s.emailRecipients.join("\n")} className="w-full">
        <Label>Send emails to</Label>
        <TextArea rows={3} placeholder="name@company.com" />
        <Description>One address per line. Gets the daily summary and urgent alerts.</Description>
      </TextField>

      <div className="grid gap-5 sm:grid-cols-3">
        <TextField name="digestHour" type="number" defaultValue={v?.digestHour ?? String(s.digestHour)} className="w-full">
          <Label>Daily summary at (hour)</Label>
          <Input />
        </TextField>
        <TextField name="timezone" defaultValue={v?.timezone ?? s.timezone} className="w-full">
          <Label>Time zone</Label>
          <Input placeholder="America/New_York" />
        </TextField>
        <TextField name="monthlyApifyBudgetUsd" type="number" defaultValue={v?.monthlyApifyBudgetUsd ?? String(s.monthlyApifyBudgetUsd)} className="w-full">
          <Label>Monthly Reddit data budget ($)</Label>
          <Input />
        </TextField>
      </div>

      {/* The Switch is controlled; this hidden input carries its value with the form. */}
      {spike && <input type="hidden" name="spikeEmails" value="on" />}
      <Switch isSelected={spike} onChange={setSpike}>
        <Switch.Content>
          <Switch.Control><Switch.Thumb /></Switch.Control>
          <span className="text-sm">Email right away when a thread blows up</span>
        </Switch.Content>
      </Switch>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" isPending={pending}>Save</Button>
        <Button
          variant="secondary"
          isPending={testing}
          onPress={() => start(async () => {
            const r = await sendTestDigest();
            if (r.message) toast.success("Test email sent"); else toast.danger(r.error ?? "Not sent");
          })}
        >
          Send a test email
        </Button>
      </div>
    </form>
  );
}
