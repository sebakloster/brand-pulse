"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { ChevronDown } from "@gravity-ui/icons";
import { timeAgo } from "@/lib/labels";

export type ConvNode = { id: string; redditId: string; parentId: string | null; author: string | null; body: string | null; createdAt: string; score: number | null };

/** The rest of the thread, folded by default. The selected item is highlighted. */
export function Conversation({ comments, focusId }: { comments: ConvNode[]; focusId: string }) {
  const [open, setOpen] = useState(false);
  if (comments.length === 0) return null;

  const ids = new Set(comments.map((c) => c.redditId));
  const children = new Map<string, ConvNode[]>();
  const roots: ConvNode[] = [];
  for (const c of comments) {
    if (c.parentId && ids.has(c.parentId)) children.set(c.parentId, [...(children.get(c.parentId) ?? []), c]);
    else roots.push(c);
  }
  const render = (nodes: ConvNode[]): React.ReactNode => (
    <ul className="space-y-3 border-l border-separator pl-4">
      {nodes.map((n) => (
        <li key={n.id} className="space-y-3">
          <div className={n.id === focusId ? "-ml-4 border-l-2 border-accent pl-[14px]" : ""}>
            <p className="text-xs text-muted">{n.author ?? "someone"} · {timeAgo(n.createdAt)}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{n.body}</p>
          </div>
          {children.has(n.redditId) && render(children.get(n.redditId)!)}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onPress={() => setOpen(!open)} aria-expanded={open}>
        <ChevronDown className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        {open ? "Hide conversation" : `Show conversation (${comments.length})`}
      </Button>
      {open && <div className="animate-rise">{render(roots)}</div>}
    </div>
  );
}
