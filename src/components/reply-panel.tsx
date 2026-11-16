"use client";

import { useRef, useState, useTransition } from "react";
import { checkText, draftReply, saveDraftStatus } from "@/app/draft-actions";
import type { Check } from "@/lib/drafts/checks";

type Draft = {
  id: string;
  finalText: string | null;
  userInput: string | null;
  status: "suggested" | "copied" | "replied";
  voiceVersion: number;
  checks: { items: Check[]; notes?: string } | null;
  createdAt: string;
};

const LEVEL = {
  pass: "text-accent-to",
  warn: "text-p2",
  fail: "text-p0",
} as const;

function Checks({ checks }: { checks: Check[] }) {
  const problems = checks.filter((c) => c.level !== "pass");
  const passed = checks.filter((c) => c.level === "pass");
  return (
    <div className="space-y-1.5 text-sm">
      {problems.map((c) => (
        <p key={c.id} className={LEVEL[c.level]}>
          {c.level === "fail" ? "✕" : "!"} {c.label}{c.detail ? <span className="text-muted"> · {c.detail}</span> : null}
        </p>
      ))}
      {passed.length > 0 && (
        <p className="text-muted"><span className={LEVEL.pass}>✓</span> {passed.map((c) => c.label).join(" · ")}</p>
      )}
    </div>
  );
}

// The page keys this component by draft id, so a new draft (regenerate/improve) remounts it with fresh state.
export function ReplyPanel(props: {
  mentionId: string;
  redditUrl: string | null;
  recommended: boolean;
  triageReason: string | null;
  replied: boolean;
  spiking?: boolean;
  draft: Draft | null;
}) {
  const { mentionId, redditUrl, recommended, triageReason, replied, draft, spiking } = props;
  const [open, setOpen] = useState(recommended || !!draft);
  const [text, setText] = useState(draft?.finalText ?? "");
  const [checks, setChecks] = useState<Check[]>(draft?.checks?.items ?? []);
  const [words, setWords] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onEdit(v: string) {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    // Re-run the code checks on hand edits (no LLM call).
    timer.current = setTimeout(() => { checkText(mentionId, v).then(setChecks).catch(() => {}); }, 400);
  }

  function act(label: string, fn: () => Promise<void>) {
    setMsg(null);
    start(async () => {
      try { await fn(); } catch { setMsg(`${label} failed. Try again.`); }
    });
  }

  if (!open) {
    return (
      <section className="rounded-3xl border border-dashed border-border p-4 text-sm sm:p-6">
        <p className="text-muted">
          <span className="text-foreground">
            {spiking ? "This thread is blowing up: no item-by-item replies." : "The AI recommends not replying here."}
          </span>
          {spiking ? " A human-approved holding statement is the safer move." : triageReason ? ` ${triageReason}` : ""}
        </p>
        <button onClick={() => setOpen(true)} className="mt-3 rounded-full bg-surface-2 px-4 py-1.5 hover:bg-border">
          Draft a reply anyway
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-3xl border border-accent-from/30 bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Reply as the brand</h2>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">
          Voice guide v{draft?.voiceVersion ?? 1} · provisional
        </span>
      </div>

      {replied && <p className="text-sm text-accent-to">✓ Marked as replied.</p>}

      {!draft ? (
        <div className="space-y-3 text-sm text-muted">
          <p>{recommended ? "No draft yet; the next background run writes one." : "No draft yet."}</p>
          <button
            disabled={pending}
            onClick={() => act("Drafting", () => draftReply(mentionId))}
            className="bg-gradient-accent rounded-full px-5 py-2 font-medium text-black disabled:opacity-60"
          >
            {pending ? "Writing…" : "Write a draft"}
          </button>
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => onEdit(e.target.value)}
            rows={6}
            className="w-full rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed outline-none focus:border-accent-from"
          />
          {draft.checks?.notes && <p className="text-sm text-muted"><span className="text-foreground">Before posting:</span> {draft.checks.notes}</p>}
          <Checks checks={checks} />
          <div className="flex flex-wrap gap-2">
            <button
              disabled={pending || !text.trim()}
              onClick={() => act("Copy", async () => {
                await navigator.clipboard.writeText(text);
                await saveDraftStatus(draft.id, text, "copied");
                if (redditUrl) window.open(redditUrl, "_blank", "noopener");
                setMsg("Copied. Paste it on Reddit, then mark it as replied.");
              })}
              className="bg-gradient-accent rounded-full px-5 py-2 text-sm font-medium text-black disabled:opacity-60"
            >
              Copy &amp; open on Reddit
            </button>
            <button
              disabled={pending || replied}
              onClick={() => act("Saving", () => saveDraftStatus(draft.id, text, "replied"))}
              className="rounded-full bg-surface-2 px-4 py-2 text-sm hover:bg-border disabled:opacity-60"
            >
              Mark as replied
            </button>
            <button
              disabled={pending}
              onClick={() => act("Regenerating", () => draftReply(mentionId))}
              className="rounded-full bg-surface-2 px-4 py-2 text-sm hover:bg-border disabled:opacity-60"
            >
              {pending ? "Working…" : "New suggestion"}
            </button>
          </div>
        </>
      )}

      <div className="space-y-2 border-t border-border pt-4">
        <label htmlFor="words" className="text-sm font-medium">Say it in your words</label>
        <p className="text-xs text-muted">Write what you want to say, plainly. Improve rewrites it in the brand voice without adding facts or promises.</p>
        <textarea
          id="words"
          value={words}
          onChange={(e) => setWords(e.target.value)}
          rows={3}
          placeholder="e.g. sorry about the screen, DM us your case number and we'll chase the replacement"
          className="w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none focus:border-accent-from"
        />
        <button
          disabled={pending || !words.trim()}
          onClick={() => act("Improve", async () => { await draftReply(mentionId, words); setWords(""); })}
          className="rounded-full bg-surface-2 px-4 py-2 text-sm hover:bg-border disabled:opacity-60"
        >
          {pending ? "Working…" : "Improve"}
        </button>
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </section>
  );
}
