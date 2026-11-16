"use client";

import { useActionState } from "react";
import { saveBrand, type BrandFormState } from "@/app/brand-actions";

type Brand = {
  id?: string; name?: string; domain?: string | null; description?: string; searchTerms?: string[];
  exclusionTerms?: string[]; blockedSubreddits?: string[]; brandSubreddits?: string[]; neverDo?: string[];
  voiceGuide?: string; voiceVersion?: number; supportUrl?: string | null; pollEveryHours?: number; backfillDays?: number;
};

const input = "w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-accent-from";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="block text-xs text-muted">{hint}</span>}
      {children}
    </label>
  );
}

export function BrandForm({ brand }: { brand?: Brand }) {
  const [state, action, pending] = useActionState<BrandFormState | undefined, FormData>(saveBrand, undefined);
  const b = brand ?? {};
  return (
    <form action={action} className="space-y-5">
      {b.id && <input type="hidden" name="id" value={b.id} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name"><input name="name" defaultValue={b.name} required className={input} /></Field>
        <Field label="Website"><input name="domain" defaultValue={b.domain ?? ""} placeholder="onepeloton.com" className={input} /></Field>
      </div>
      <Field label="What the brand is" hint="Used by the AI to tell the brand apart from other meanings of the word.">
        <textarea name="description" defaultValue={b.description} rows={3} required className={input} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Search terms" hint="Comma or line separated.">
          <textarea name="searchTerms" defaultValue={b.searchTerms?.join(", ")} rows={2} className={input} />
        </Field>
        <Field label="Exclusion phrases" hint="Only remove their own match (e.g. “le peloton”).">
          <textarea name="exclusionTerms" defaultValue={b.exclusionTerms?.join(", ")} rows={2} className={input} />
        </Field>
        <Field label="Blocked subreddits" hint="Where the word never means the brand.">
          <textarea name="blockedSubreddits" defaultValue={b.blockedSubreddits?.join(", ")} rows={2} className={input} />
        </Field>
        <Field label="Brand communities" hint="Every post there counts, even without the word.">
          <textarea name="brandSubreddits" defaultValue={b.brandSubreddits?.join(", ")} rows={2} className={input} />
        </Field>
      </div>
      <Field label="The brand never…" hint="One rule per line. Used by triage and drafting.">
        <textarea name="neverDo" defaultValue={b.neverDo?.join("\n")} rows={4} className={input} />
      </Field>
      <Field label={`Voice guide${b.voiceVersion ? ` (v${b.voiceVersion})` : ""}`} hint="Editing it creates a new version; drafts show which version wrote them.">
        <textarea name="voiceGuide" defaultValue={b.voiceGuide} rows={10} className={`${input} font-mono text-xs`} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Support link" hint="The only link drafts may use."><input name="supportUrl" defaultValue={b.supportUrl ?? ""} className={input} /></Field>
        <Field label="Poll every (hours)" hint="When live polling is on."><input name="pollEveryHours" type="number" min={1} max={24} defaultValue={b.pollEveryHours ?? 6} className={input} /></Field>
        <Field label="First run looks back (days)"><input name="backfillDays" type="number" min={1} max={7} defaultValue={b.backfillDays ?? 2} className={input} /></Field>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="bg-gradient-accent rounded-full px-6 py-2.5 text-sm font-medium text-black disabled:opacity-60">
          {pending ? "Saving…" : b.id ? "Save changes" : "Add brand"}
        </button>
        {state?.error && <p className="text-sm text-p0">{state.error}</p>}
        {state?.saved && <p className="text-sm text-accent-to">Saved.</p>}
      </div>
    </form>
  );
}
