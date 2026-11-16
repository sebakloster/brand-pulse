"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/react";
import { CircleCheckFill, CircleXmarkFill, Xmark } from "@gravity-ui/icons";
import type { Activity } from "@/lib/activity";

const DISMISSED_KEY = "bp-dismissed-runs";
export const ACTIVITY_EVENT = "bp:activity"; // fired when a check starts, to poll right away

function loadDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]")); } catch { return new Set(); }
}

/**
 * Small floating status for Reddit checks. Works for several brands at once, stays out of
 * the way while you keep using the app, and turns green when a brand's new results are ready.
 */
export function ActivityTray() {
  const router = useRouter();
  const [items, setItems] = useState<Activity[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => (typeof window === "undefined" ? new Set() : loadDismissed()));
  const prevPhase = useRef<Map<string, Activity["phase"]>>(new Map());

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/activity", { cache: "no-store" });
      if (!res.ok) return;
      const next: Activity[] = await res.json();
      // When a check finishes, refresh the current page so new results show up in place.
      let finished = false;
      for (const a of next) {
        const before = prevPhase.current.get(a.runId);
        if (before && before !== "done" && a.phase === "done") finished = true;
        prevPhase.current.set(a.runId, a.phase);
      }
      setItems(next);
      if (finished) router.refresh();
    } catch { /* offline or signed out: try again on the next tick */ }
  }, [router]);

  const active = items.some((a) => a.phase === "searching" || a.phase === "analyzing");

  useEffect(() => {
    const first = setTimeout(poll, 0);
    const timer = setInterval(poll, active ? 4000 : 30000);
    const onEvent = () => { setTimeout(poll, 300); };
    window.addEventListener(ACTIVITY_EVENT, onEvent);
    return () => { clearTimeout(first); clearInterval(timer); window.removeEventListener(ACTIVITY_EVENT, onEvent); };
  }, [poll, active]);

  function dismiss(runId: string) {
    const next = new Set(dismissed).add(runId);
    setDismissed(next);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next].slice(-50))); } catch { /* private mode */ }
  }

  const visible = items.filter((a) => !dismissed.has(a.runId));
  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6">
      {visible.map((a) => {
        const done = a.phase === "done";
        const failed = a.phase === "failed";
        const text = failed ? `Couldn't check ${a.brand}`
          : a.phase === "searching" ? `Checking Reddit for ${a.brand}…`
          : a.phase === "analyzing" ? `Analyzing ${a.pending} mention${a.pending === 1 ? "" : "s"} for ${a.brand}…`
          : a.newCount > 0 ? `${a.brand}: ${a.newCount} new to look at`
          : a.found > 0 ? `${a.brand}: ${a.found} new mention${a.found === 1 ? "" : "s"}, nothing urgent`
          : `${a.brand}: no new mentions`;
        const sub = failed ? a.error ?? "Try again from the inbox."
          : a.phase === "searching" ? "Usually takes 1–3 minutes. Keep working."
          : a.phase === "analyzing" ? "Almost done."
          : "Open the inbox";
        return (
          <div
            key={a.runId}
            className={`animate-rise pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-overlay/95 px-4 py-3 shadow-lg backdrop-blur transition-colors duration-500 sm:w-80 ${
              done ? "border-success/40" : failed ? "border-danger/40" : "border-border"
            }`}
          >
            <span className="shrink-0">
              {done ? <CircleCheckFill className="size-5 text-success" />
                : failed ? <CircleXmarkFill className="size-5 text-danger" />
                : <Spinner size="sm" />}
            </span>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => { router.push(`/b/${a.brandId}`); if (done || failed) dismiss(a.runId); }}
            >
              <p className="truncate text-sm font-medium">{text}</p>
              <p className="truncate text-xs text-muted">{sub}</p>
            </button>
            {(done || failed) && (
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(a.runId)}
                className="shrink-0 rounded-full p-1 text-muted transition-colors hover:bg-surface-secondary hover:text-foreground">
                <Xmark className="size-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
