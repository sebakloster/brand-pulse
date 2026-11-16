"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, Description, Input, Label, TextArea, TextField, toast } from "@heroui/react";
import { ChevronDown } from "@gravity-ui/icons";
import { saveBrand, type BrandFormState } from "@/app/brand-actions";

type Brand = {
  id?: string; name?: string; domain?: string | null; description?: string; searchTerms?: string[];
  exclusionTerms?: string[]; blockedSubreddits?: string[]; brandSubreddits?: string[]; neverDo?: string[];
  voiceGuide?: string; supportUrl?: string | null; backfillDays?: number;
};

function Field({ name, label, hint, value, multiline, rows = 3, type = "text", placeholder }: {
  name: string; label: string; hint?: string; value?: string | number; multiline?: boolean; rows?: number; type?: string; placeholder?: string;
}) {
  return (
    <TextField name={name} defaultValue={value === undefined ? undefined : String(value)} type={type} className="w-full">
      <Label>{label}</Label>
      {multiline ? <TextArea rows={rows} placeholder={placeholder} /> : <Input placeholder={placeholder} />}
      {hint && <Description>{hint}</Description>}
    </TextField>
  );
}

export function BrandForm({ brand }: { brand?: Brand }) {
  const [state, action, pending] = useActionState<BrandFormState | undefined, FormData>(saveBrand, undefined);
  const [advanced, setAdvanced] = useState(false);
  const b = brand ?? {};
  const v = state?.values; // what was typed, kept after a validation error

  useEffect(() => {
    if (state?.saved) toast.success("Saved");
    if (state?.error) toast.danger(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-5">
      {b.id && <input type="hidden" name="id" value={b.id} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="name" label="Name" value={v?.name ?? b.name} placeholder="Peloton" />
        <Field name="domain" label="Website" value={v?.domain ?? b.domain ?? ""} placeholder="onepeloton.com" />
      </div>
      <Field name="description" label="What the brand is" multiline
        hint="Helps tell the brand apart from other meanings of the same word."
        value={v?.description ?? b.description} />
      <Field name="searchTerms" label="Search for" hint="Words to look for on Reddit, separated by commas."
        value={v?.searchTerms ?? b.searchTerms?.join(", ")} placeholder="Peloton" />

      <Button variant="ghost" size="sm" onPress={() => setAdvanced(!advanced)} aria-expanded={advanced}>
        <ChevronDown className={`size-4 transition-transform duration-200 ${advanced ? "rotate-180" : ""}`} />
        Advanced
      </Button>

      {/* Kept mounted (just hidden) so its values are always submitted. */}
      <div className={advanced ? "animate-rise space-y-5" : "hidden"}>
        <Field name="exclusionTerms" label="Ignore phrases" hint="Phrases that mean something else, e.g. “le peloton”."
          value={v?.exclusionTerms ?? b.exclusionTerms?.join(", ")} multiline rows={2} />
        <Field name="blockedSubreddits" label="Ignore these subreddits" hint="Communities where the word never means the brand."
          value={v?.blockedSubreddits ?? b.blockedSubreddits?.join(", ")} multiline rows={2} />
        <Field name="brandSubreddits" label="The brand's own communities" hint="Every post there counts, even if it doesn't name the brand."
          value={v?.brandSubreddits ?? b.brandSubreddits?.join(", ")} multiline rows={2} />
        <Field name="neverDo" label="The brand never…" hint="One rule per line."
          value={v?.neverDo ?? b.neverDo?.join("\n")} multiline rows={4} />
        <Field name="voiceGuide" label="Voice guide" hint="How replies should sound. Edits create a new version."
          value={v?.voiceGuide ?? b.voiceGuide} multiline rows={8} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="supportUrl" label="Support link" value={v?.supportUrl ?? b.supportUrl ?? ""} />
          <Field name="backfillDays" label="First check looks back (days)" type="number" value={v?.backfillDays ?? b.backfillDays ?? 2} />
        </div>
      </div>

      <Button type="submit" isPending={pending}>{b.id ? "Save changes" : "Add brand"}</Button>
    </form>
  );
}
