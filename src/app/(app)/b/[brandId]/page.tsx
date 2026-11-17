import Link from "next/link";
import { Alert } from "@heroui/react";
import { CircleCheck, Magnifier } from "@gravity-ui/icons";
import { CheckNowButton } from "@/components/check-now-button";
import { InboxItemCard } from "@/components/inbox-item";
import { timeAgo } from "@/lib/labels";
import { getInbox, getLastCheck, getSpikes, type View } from "@/lib/queries";

export default async function InboxPage({ params, searchParams }: {
  params: Promise<{ brandId: string }>; searchParams: Promise<{ view?: string }>;
}) {
  const { brandId } = await params;
  const view: View = (await searchParams).view === "done" ? "done" : "todo";
  const [{ items, counts }, spikes, last] = await Promise.all([getInbox(brandId, view), getSpikes(brandId), getLastCheck(brandId)]);
  const neverChecked = !last && counts.todo + counts.done === 0;

  if (neverChecked) {
    return (
      <div className="animate-rise flex flex-col items-center gap-4 py-16 text-center">
        <Magnifier className="size-8 text-muted" />
        <div className="space-y-1">
          <p className="font-medium">No mentions yet</p>
          <p className="max-w-sm text-sm text-muted">
            Check Reddit to find what people are saying about this brand. It takes a couple of minutes, and you can keep working meanwhile.
          </p>
        </div>
        <CheckNowButton brandId={brandId} variant="primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {view === "todo" && spikes.map((s) => (
        <Link key={s.id} href={`/b/${brandId}/m/${s.id}`} className="animate-rise block">
          <Alert status="danger" className="lift">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>A thread is blowing up in r/{s.subreddit}{s.simulated ? " (demo)" : ""}</Alert.Title>
              <Alert.Description>
                {s.title}. Agree one response with the client before anyone replies.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        </Link>
      ))}

      <div className="flex flex-wrap items-center gap-1 text-sm">
        {([["todo", "To do", counts.todo], ["done", "Done", counts.done]] as const).map(([id, label, n]) => (
          <Link
            key={id}
            href={id === "todo" ? `/b/${brandId}` : `/b/${brandId}?view=done`}
            className={`rounded-full px-3 py-1.5 transition-colors ${view === id ? "bg-surface text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {label} <span className="text-muted">{n}</span>
          </Link>
        ))}
        <span className="ml-auto hidden text-xs text-muted sm:inline">
          {last?.running ? "Checking now…" : last ? `Last checked ${timeAgo(last.at)}` : ""}
        </span>
        <CheckNowButton brandId={brandId} busy={!!last?.running} />
      </div>

      {items.length === 0 ? (
        <div className="animate-rise flex flex-col items-center gap-3 py-16 text-center text-muted">
          {view === "todo" && last?.running ? (
            <>
              <Magnifier className="size-8 animate-pulse text-muted" />
              <p>Checking Reddit… new mentions will appear here.</p>
            </>
          ) : (
            <>
              <CircleCheck className="size-8 text-success" />
              <p>{view === "todo" ? "Nothing needs you right now." : "Nothing here yet."}</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => <InboxItemCard key={item.id} item={item} index={i} />)}
        </div>
      )}
    </div>
  );
}
