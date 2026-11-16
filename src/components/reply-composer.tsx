"use client";

import { useRef, useState, useTransition } from "react";
import { Button, TextArea, toast } from "@heroui/react";
import { Copy, MagicWand } from "@gravity-ui/icons";
import { checkText, draftReply, saveDraftStatus } from "@/app/draft-actions";
import type { Check } from "@/lib/drafts/checks";

type Draft = { id: string; finalText: string | null; checks: { items: Check[]; notes?: string } | null } | null;

/** The page keys this component by draft id, so a new draft remounts it with fresh state. */
export function ReplyComposer({ mentionId, redditUrl, draft, replied }: {
  mentionId: string; redditUrl: string | null; draft: Draft; replied: boolean;
}) {
  const [text, setText] = useState(draft?.finalText ?? "");
  const [checks, setChecks] = useState<Check[]>(draft?.checks?.items ?? []);
  const [ownWords, setOwnWords] = useState("");
  const [showOwn, setShowOwn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const issues = checks.filter((c) => c.level !== "pass");

  function run(label: string, fn: () => Promise<void>, success?: string) {
    setBusy(label);
    start(async () => {
      try { await fn(); if (success) toast.success(success); }
      catch { toast.danger("Something went wrong. Please try again."); }
      finally { setBusy(null); }
    });
  }

  function onEdit(v: string) {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { checkText(mentionId, v).then(setChecks).catch(() => {}); }, 400);
  }

  if (!draft) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted">No draft yet.</p>
        <Button isPending={busy === "draft"} onPress={() => run("draft", () => draftReply(mentionId))}>
          <MagicWand className="size-4" /> Write a draft
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TextArea
        aria-label="Reply"
        value={text}
        onChange={(e) => onEdit(e.target.value)}
        rows={6}
        className="w-full"
      />

      {issues.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {issues.map((c) => (
            <li key={c.id} className={c.level === "fail" ? "text-danger" : "text-warning"}>
              {c.label}{c.detail ? <span className="text-muted"> — {c.detail}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-success">Tone check passed.</p>
      )}
      {draft.checks?.notes && <p className="text-sm text-muted">{draft.checks.notes}</p>}

      <div className="flex flex-wrap gap-2">
        <Button
          isDisabled={!text.trim() || replied}
          onPress={() => run("copy", async () => {
            await navigator.clipboard.writeText(text);
            await saveDraftStatus(draft.id, text, "copied");
            if (redditUrl) window.open(redditUrl, "_blank", "noopener");
          }, "Copied. Paste it on Reddit, then mark it as replied.")}
        >
          <Copy className="size-4" /> Copy &amp; open Reddit
        </Button>
        <Button
          variant="secondary"
          isDisabled={replied}
          isPending={busy === "replied"}
          onPress={() => run("replied", () => saveDraftStatus(draft.id, text, "replied"), "Marked as replied")}
        >
          {replied ? "Replied" : "Mark as replied"}
        </Button>
        <Button variant="ghost" isPending={busy === "draft"} onPress={() => run("draft", () => draftReply(mentionId))}>
          New suggestion
        </Button>
      </div>

      <div className="border-t border-separator pt-4">
        {!showOwn ? (
          <Button variant="ghost" size="sm" onPress={() => setShowOwn(true)}>
            <MagicWand className="size-4" /> Write it in your own words
          </Button>
        ) : (
          <div className="animate-rise space-y-2">
            <TextArea
              aria-label="What you want to say"
              placeholder="e.g. sorry about the screen, DM us your case number and we'll chase it"
              value={ownWords}
              onChange={(e) => setOwnWords(e.target.value)}
              rows={3}
              className="w-full"
            />
            <Button
              variant="secondary"
              isDisabled={!ownWords.trim()}
              isPending={busy === "improve"}
              onPress={() => run("improve", () => draftReply(mentionId, ownWords), "Rewritten in the brand's voice")}
            >
              Rewrite in brand voice
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
