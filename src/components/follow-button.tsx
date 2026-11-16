"use client";

import { useState, useTransition } from "react";
import { setFollowed } from "@/app/actions";

export function FollowButton({ postId, initial }: { postId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState(false);
  const [, start] = useTransition();
  return (
    <button
      aria-pressed={on}
      onClick={() => {
        const next = !on;
        setOn(next);
        setError(false);
        start(async () => {
          try { await setFollowed(postId, next); } catch { setOn(!next); setError(true); }
        });
      }}
      className={`rounded-full px-4 py-1.5 text-sm ${on ? "bg-accent-from/15 text-accent-from" : "bg-surface-2 hover:bg-border"}`}
    >
      {on ? "★ Following" : "☆ Follow thread"}
      {error && <span className="ml-2 text-p0">(not saved)</span>}
    </button>
  );
}
