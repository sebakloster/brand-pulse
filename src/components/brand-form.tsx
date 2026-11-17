"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button, Description, Input, Label, Skeleton, Spinner, TextArea, TextField, toast } from "@heroui/react";
import { ChevronDown, MagicWand } from "@gravity-ui/icons";
import { saveBrand, suggestBrand, type BrandFormState } from "@/app/brand-actions";
import type { BrandSuggestion } from "@/lib/brands/suggest";

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

// Each failed save returns a new state object; giving it an id lets the fields remount with
// what was typed (React 19 resets uncontrolled fields after a form action).
const stateIds = new WeakMap<object, number>();
let lastStateId = 0;
function idOf(o: object | undefined) {
  if (!o) return 0;
  if (!stateIds.has(o)) stateIds.set(o, ++lastStateId);
  return stateIds.get(o)!;
}

const DRAFT_STEPS = [
  "Reading the website…",
  "Working out what the brand is…",
  "Picking search terms and communities…",
  "Writing the voice guide…",
  "Almost done…",
];

/** Shown in place of the fields while the AI drafts them. */
function DraftingState() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, DRAFT_STEPS.length - 1)), 7000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="animate-rise space-y-5" aria-live="polite">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <Spinner size="sm" />
        <div>
          <p key={step} className="animate-rise text-sm font-medium">{DRAFT_STEPS[step]}</p>
          <p className="text-xs text-muted">This usually takes 20–40 seconds.</p>
        </div>
      </div>
      {[3, 1].map((lines, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-32 rounded-md" />
          <Skeleton className={`${lines > 1 ? "h-20" : "h-9"} w-full rounded-lg`} />
        </div>
      ))}
    </div>
  );
}

/** Field values as strings: from an AI draft, from a failed save, or from the saved brand. */
function initialValues(b: Brand, ai: BrandSuggestion | null, typed?: Record<string, string>) {
  const src = ai ?? b;
  const list = (xs: string[] | undefined, sep = ", ") => xs?.join(sep) ?? "";
  return {
    description: typed?.description ?? src.description ?? "",
    searchTerms: typed?.searchTerms ?? list(src.searchTerms),
    exclusionTerms: typed?.exclusionTerms ?? list(src.exclusionTerms),
    blockedSubreddits: typed?.blockedSubreddits ?? list(src.blockedSubreddits),
    brandSubreddits: typed?.brandSubreddits ?? list(src.brandSubreddits),
    neverDo: typed?.neverDo ?? list(src.neverDo, "\n"),
    voiceGuide: typed?.voiceGuide ?? src.voiceGuide ?? "",
    supportUrl: typed?.supportUrl ?? src.supportUrl ?? "",
  };
}

export function BrandForm({ brand }: { brand?: Brand }) {
  const [state, action, pending] = useActionState<BrandFormState | undefined, FormData>(saveBrand, undefined);
  const b = brand ?? {};
  const [name, setName] = useState(b.name ?? "");
  const [domain, setDomain] = useState(b.domain ?? "");
  const [advanced, setAdvanced] = useState(false);
  const [ai, setAi] = useState<BrandSuggestion | null>(null);
  const [drafting, startDraft] = useTransition();
  // Remounting the fields is how a new AI draft (or a failed save) replaces their contents.
  const [formKey, setFormKey] = useState(0);
  const v = initialValues(b, ai, state?.values);

  useEffect(() => {
    if (state?.saved) toast.success("Saved");
    if (state?.error) toast.danger(state.error);
  }, [state]);

  const canDraft = name.trim().length > 0 && domain.trim().length > 0;

  function fillWithAi() {
    startDraft(async () => {
      const r = await suggestBrand(name, domain);
      if (!r.ok) { toast.danger(r.message); return; }
      setAi(r.suggestion);
      setFormKey((k) => k + 1);
      setAdvanced(true);
      toast.success("Drafted with AI", { description: "Review the fields, then save." });
    });
  }

  return (
    <form action={action} className="space-y-5">
      {b.id && <input type="hidden" name="id" value={b.id} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="name" value={name} onChange={setName} isRequired className="w-full">
          <Label>Name</Label>
          <Input placeholder="Peloton" />
        </TextField>
        <TextField name="domain" value={domain} onChange={setDomain} isRequired className="w-full">
          <Label>Website</Label>
          <Input placeholder="onepeloton.com" />
        </TextField>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" isDisabled={!canDraft} isPending={drafting} onPress={fillWithAi}>
          {!drafting && <MagicWand className="size-4" />}
          {drafting ? "Filling in…" : b.id ? "Redraft with AI" : "Fill in with AI"}
        </Button>
        {!drafting && (
          <span className="text-xs text-muted">
            {ai
              ? ai.readSite ? `Filled in from ${domain}` : "Filled in with AI"
              : canDraft ? "Drafts every field below from the website." : "Add a name and website to draft the rest with AI."}
          </span>
        )}
      </div>

      {drafting && <DraftingState />}
      {/* Hidden, not unmounted, while drafting so nothing typed is lost if the draft fails. */}
      <div key={`${formKey}-${state?.error ? idOf(state) : 0}`}
        className={drafting ? "hidden" : ai ? "animate-rise space-y-5" : "space-y-5"}>
        <Field name="description" label="What the brand is" multiline
          hint="Helps tell the brand apart from other meanings of the same word."
          value={v.description} />
        <Field name="searchTerms" label="Search for" hint="Words to look for on Reddit, separated by commas. Defaults to the name."
          value={v.searchTerms} placeholder={name || "Peloton"} />

        <Button variant="ghost" size="sm" onPress={() => setAdvanced(!advanced)} aria-expanded={advanced}>
          <ChevronDown className={`size-4 transition-transform duration-200 ${advanced ? "rotate-180" : ""}`} />
          Advanced
        </Button>

        {/* Kept mounted (just hidden) so its values are always submitted. */}
        <div className={advanced ? "animate-rise space-y-5" : "hidden"}>
          <Field name="exclusionTerms" label="Ignore phrases" hint="Phrases that mean something else, e.g. “le peloton”."
            value={v.exclusionTerms} multiline rows={2} />
          <Field name="blockedSubreddits" label="Ignore these subreddits" hint="Communities where the word never means the brand."
            value={v.blockedSubreddits} multiline rows={2} />
          <Field name="brandSubreddits" label="The brand's own communities" hint="Every post there counts, even if it doesn't name the brand."
            value={v.brandSubreddits} multiline rows={2} />
          <Field name="neverDo" label="The brand never…" hint="One rule per line."
            value={v.neverDo} multiline rows={5} />
          <Field name="voiceGuide" label="Voice guide" hint="How replies should sound. Edits create a new version."
            value={v.voiceGuide} multiline rows={10} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="supportUrl" label="Support link" value={v.supportUrl} />
            <Field name="backfillDays" label="First check looks back (days)" type="number"
              hint="The first check also fetches more (up to 200 posts)."
              value={state?.values?.backfillDays ?? b.backfillDays ?? 14} />
          </div>
        </div>
      </div>

      <Button type="submit" isPending={pending} isDisabled={drafting}>{b.id ? "Save changes" : "Add brand"}</Button>
    </form>
  );
}
