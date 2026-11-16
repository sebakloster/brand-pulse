import Link from "next/link";
import { QueueCard } from "@/components/queue-card";
import { PAGE_SIZE, TABS, getQueue, getTabCounts, type Tab } from "@/lib/queries";

export const metadata = { title: "Queue · Brand Pulse" };

const EMPTY: Record<Tab, string> = {
  attention: "Nothing needs you right now. Quiet days are normal.",
  reply: "No reply suggestions open.",
  route: "Nothing to route.",
  monitor: "Nothing to monitor.",
  followed: "You're not following any threads yet. Use ☆ Follow on a card.",
  all: "No open items.",
  done: "Nothing discarded or handled yet.",
};

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const sp = await searchParams;
  const tab = (TABS.some((t) => t.id === sp.tab) ? sp.tab : "attention") as Tab;
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ items, total }, counts] = await Promise.all([getQueue(tab, page), getTabCounts()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {tab === "followed" ? <>Followed <span className="text-gradient">threads</span></> : <>What needs <span className="text-gradient">attention</span></>}
        </h1>
        <p className="text-sm text-muted">Sorted by importance. Every item says why it&apos;s here.</p>
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/queue?tab=${t.id}`}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${
                t.id === tab ? "bg-gradient-accent font-medium text-black" : "bg-surface-2 text-muted hover:text-foreground"
              }`}
            >
              {t.label} <span className={t.id === tab ? "text-black/60" : "text-muted/70"}>{counts[t.id]}</span>
            </Link>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-8 text-center text-muted">{EMPTY[tab]}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => <QueueCard key={item.id} item={item} />)}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link className="rounded-full bg-surface-2 px-4 py-1.5" href={`/queue?tab=${tab}&page=${page - 1}`}>← Newer</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link className="rounded-full bg-surface-2 px-4 py-1.5" href={`/queue?tab=${tab}&page=${page + 1}`}>Older →</Link>}
        </div>
      )}
    </div>
  );
}
