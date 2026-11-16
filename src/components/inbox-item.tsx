import Link from "next/link";
import { Card } from "@heroui/react";
import { URGENCY, nextStep, timeAgo } from "@/lib/labels";
import type { InboxItem } from "@/lib/queries";

export function InboxItemCard({ item, index }: { item: InboxItem; index: number }) {
  const u = item.importance ? URGENCY[item.importance] : null;
  const failed = item.pipelineStatus === "triage_failed";
  const done = item.userStatus !== "open";
  const doneLabel = item.userStatus === "replied" ? "Replied" : item.userStatus === "handled" ? "Done" : "Dismissed";
  return (
    <Link
      href={`/b/${item.brandId}/m/${item.id}`}
      className="animate-rise block"
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
    >
      <Card className="lift border border-transparent hover:border-border">
        <Card.Content className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            {done ? (
              <span className="text-muted">{doneLabel}</span>
            ) : failed ? (
              <span className="text-danger">Couldn&apos;t analyze — open to check</span>
            ) : (
              <>
                <span className={`size-2 rounded-full ${u?.dot ?? "bg-muted"}`} />
                <span className="font-medium">{u?.label}</span>
                <span className="text-muted">· {nextStep(item.action, item.routeTo)}</span>
              </>
            )}
            <span className="ml-auto text-muted">{timeAgo(item.createdAt)}</span>
          </div>
          <p className="leading-snug">{item.reason ?? item.body?.slice(0, 160)}</p>
          <p className="truncate text-sm text-muted">
            r/{item.subreddit}
            {item.title ? ` · ${item.title}` : ""}
          </p>
        </Card.Content>
      </Card>
    </Link>
  );
}
