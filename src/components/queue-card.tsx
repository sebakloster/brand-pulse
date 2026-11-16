"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { discardMention, markMention, setFollowed } from "@/app/actions";
import { ActionBadge, Chip, ImportanceBadge, RiskFlags, SentimentDot } from "@/components/badges";
import { DISCARD_REASONS, type DiscardReason, timeAgo } from "@/lib/labels";
import type { QueueItem } from "@/lib/queries";

// Optimistic UI: the card reacts immediately; on a server error it
// comes back with a message instead of silently losing the change.
export function QueueCard({ item }: { item: QueueItem }) {
  const [hidden, setHidden] = useState(false);
  const [followed, setFollowedState] = useState(item.followed);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function run(optimistic: () => void, revert: () => void, action: () => Promise<void>) {
    setError(null);
    optimistic();
    start(async () => {
      try { await action(); } catch { revert(); setError("Couldn't save that. Try again."); }
    });
  }

  if (hidden) return null;
  const done = item.userStatus !== "open";
  const href = `/m/${item.id}`;

  return (
    <article className="rounded-3xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {item.pipelineStatus === "triage_failed" ? (
          <Chip className="border-p0/40 text-p0">Triage failed</Chip>
        ) : (
          <ImportanceBadge value={item.importance} />
        )}
        <ActionBadge action={item.action} routeTo={item.routeTo} />
        <RiskFlags flags={item.riskFlags} />
        {item.limitedContext && <Chip className="text-muted" >Limited context</Chip>}
        {done && <Chip className="text-muted">{item.userStatus}{item.discardReason ? ` · ${DISCARD_REASONS[item.discardReason as DiscardReason] ?? item.discardReason}` : ""}</Chip>}
      </div>

      <Link href={href} className="mt-3 block space-y-1.5">
        <p className="font-medium leading-snug">
          {item.reason ?? item.triageError ?? "No reason recorded"}
        </p>
        <p className="text-sm text-muted">
          <span className="text-foreground/80">{item.kind === "post" ? "Post" : "Comment"}</span>
          {" in "}r/{item.subreddit} · {timeAgo(item.createdAt)}
          {item.title ? <> · <span className="italic">“{item.title.slice(0, 90)}{item.title.length > 90 ? "…" : ""}”</span></> : null}
        </p>
        {item.body && (
          <p className="line-clamp-2 text-sm text-muted/80">{item.body}</p>
        )}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SentimentDot value={item.sentiment} />
        <span className="flex-1" />
        {error && <span className="text-xs text-p0">{error}</span>}
        <Link href={href} className="rounded-full bg-surface-2 px-4 py-1.5 text-sm hover:bg-border">Open</Link>
        {item.threadId && (
          <button
            onClick={() => run(() => setFollowedState(!followed), () => setFollowedState(followed),
              () => setFollowed(item.threadId!, !followed))}
            className={`rounded-full px-4 py-1.5 text-sm ${followed ? "bg-accent-from/15 text-accent-from" : "bg-surface-2 hover:bg-border"}`}
            aria-pressed={followed}
          >
            {followed ? "★ Following" : "☆ Follow"}
          </button>
        )}
        {done ? (
          <button
            onClick={() => run(() => setHidden(true), () => setHidden(false), () => markMention(item.id, "open"))}
            className="rounded-full bg-surface-2 px-4 py-1.5 text-sm hover:bg-border"
          >
            Restore
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => setMenu(!menu)}
              className="rounded-full bg-surface-2 px-4 py-1.5 text-sm hover:bg-border"
              aria-expanded={menu}
            >
              Discard
            </button>
            {menu && (
              <div className="absolute right-0 bottom-full z-10 mb-2 w-56 overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-xl">
                {(Object.keys(DISCARD_REASONS) as DiscardReason[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => { setMenu(false); run(() => setHidden(true), () => setHidden(false), () => discardMention(item.id, r)); }}
                    className="block w-full px-4 py-2.5 text-left text-sm hover:bg-border"
                  >
                    {DISCARD_REASONS[r]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
