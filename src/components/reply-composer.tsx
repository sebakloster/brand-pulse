"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Skeleton, Spinner, TextArea, toast } from "@heroui/react";
import { ArrowRotateRight, Copy, MagicWand, Pencil } from "@gravity-ui/icons";
import { checkText, draftReply, saveDraftStatus } from "@/app/draft-actions";
import type { Check } from "@/lib/drafts/checks";

type Draft = { id: string; finalText: string | null; checks: { items: Check[] } | null } | null;
type Busy = "suggest" | "own" | "copy" | "replied" | null;

const LIMIT = 400;

/** Placeholder while the AI writes, so it's obvious something is happening. */
function Writing({ label }: { label: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 12_000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="animate-rise space-y-3 rounded-xl border border-border bg-surface p-4" aria-live="polite">
      <div className="flex items-center gap-2 text-sm">
        <Spinner size="sm" />
        <span className="font-medium">{label}</span>
        <span className="text-muted">{slow ? "· almost there" : "· about 10–20 seconds"}</span>
      </div>
      <Skeleton className="h-3 w-full rounded-md" />
      <Skeleton className="h-3 w-4/5 rounded-md" />
      <Skeleton className="h-3 w-2/5 rounded-md" />
    </div>
  );
}

/** The page keys this component by draft id, so a new draft remounts it with fresh state. */
export function ReplyComposer({ mentionId, redditUrl, draft, replied }: {
  mentionId: string; redditUrl: string | null; draft: Draft; replied: boolean;
}) {
  const [text, setText] = useState(draft?.finalText ?? "");
  const [checks, setChecks] = useState<Check[]>(draft?.checks?.items ?? []);
  const [ownWords, setOwnWords] = useState("");
  const [showOwn, setShowOwn] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const issues = checks.filter((c) => c.level !== "pass" && c.id !== "length");
  const writing = busy === "suggest" || busy === "own";

  function write(kind: "suggest" | "own") {
    setBusy(kind);
    start(async () => {
      const r = await draftReply(mentionId, kind === "own" ? ownWords : undefined).catch(() => null);
      // On success the page re-renders with the new draft and this component remounts.
      if (!r?.ok) {
        toast.danger(r?.message ?? "Couldn't reach the server. Please try again.");
        setBusy(null);
      }
    });
  }

  function act(kind: "copy" | "replied", fn: () => Promise<void>, success: string) {
    setBusy(kind);
    start(async () => {
      try { await fn(); toast.success(success); }
      catch { toast.danger("Something went wrong. Please try again."); }
      finally { setBusy(null); }
    });
  }

  function onEdit(v: string) {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { checkText(mentionId, v).then(setChecks).catch(() => {}); }, 400);
  }

  const ownForm = (
    <div className="animate-rise space-y-2">
      <TextArea
        aria-label="What you want to say"
        placeholder="e.g. sorry about the screen, DM us your case number and we'll chase it"
        value={ownWords}
        onChange={(e) => setOwnWords(e.target.value)}
        rows={3}
        className="w-full"
        autoFocus
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" isDisabled={!ownWords.trim() || writing} onPress={() => write("own")}>
          <MagicWand className="size-4" /> Turn into a reply
        </Button>
        <Button size="sm" variant="ghost" onPress={() => setShowOwn(false)}>Cancel</Button>
      </div>
    </div>
  );

  if (writing) return <Writing label={busy === "own" ? "Polishing your words…" : "Writing a reply…"} />;

  if (!draft) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Get a suggested reply, or say what you want in a few words and the AI will polish it.</p>
        {showOwn ? ownForm : (
          <div className="flex flex-wrap gap-2">
            <Button onPress={() => write("suggest")}>
              <MagicWand className="size-4" /> Suggest a reply
            </Button>
            <Button variant="secondary" onPress={() => setShowOwn(true)}>
              <Pencil className="size-4" /> Write it my way
            </Button>
          </div>
        )}
      </div>
    );
  }

  const len = text.trim().length;
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <TextArea
          aria-label="Reply"
          value={text}
          onChange={(e) => onEdit(e.target.value)}
          rows={4}
          className="w-full"
        />
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-muted">Suggested by AI. Edit it however you like before posting.</span>
          <span className={len > LIMIT ? "text-warning" : "text-muted"}>{len}/{LIMIT}</span>
        </div>
      </div>

      {issues.length > 0 && (
        <ul className="space-y-1 text-sm">
          {issues.map((c) => (
            <li key={c.id} className={c.level === "fail" ? "text-danger" : "text-warning"}>
              {c.label}{c.detail ? <span className="text-muted"> · {c.detail}</span> : null}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          isDisabled={!text.trim() || replied || busy !== null}
          onPress={() => act("copy", async () => {
            await navigator.clipboard.writeText(text);
            await saveDraftStatus(draft.id, text, "copied");
            if (redditUrl) window.open(redditUrl, "_blank", "noopener");
          }, "Copied. Paste it on Reddit, then mark it as replied.")}
        >
          <Copy className="size-4" /> Copy &amp; open Reddit
        </Button>
        <Button
          variant="secondary"
          isDisabled={replied || busy !== null}
          onPress={() => act("replied", () => saveDraftStatus(draft.id, text, "replied"), "Marked as replied")}
        >
          {busy === "replied" && <Spinner size="sm" color="current" />}
          {replied ? "Replied" : "Mark as replied"}
        </Button>
      </div>

      {!replied && (
        <div className="border-t border-separator pt-3">
          {showOwn ? ownForm : (
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" isDisabled={busy !== null} onPress={() => write("suggest")}>
                <ArrowRotateRight className="size-4" /> Try a different reply
              </Button>
              <Button size="sm" variant="ghost" isDisabled={busy !== null} onPress={() => setShowOwn(true)}>
                <Pencil className="size-4" /> Write it my way
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
