import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionBadge, Chip, ImportanceBadge, RiskFlags, SentimentDot } from "@/components/badges";
import { FollowButton } from "@/components/follow-button";
import { ReplyPanel } from "@/components/reply-panel";
import { latestDraft } from "@/lib/drafts/generate";
import { timeAgo } from "@/lib/labels";
import { getThread, type ThreadNode } from "@/lib/queries";

export const metadata = { title: "Thread · Brand Pulse" };

function TriageBox({ n }: { n: ThreadNode }) {
  if (!n.importance && n.pipelineStatus !== "triage_failed") return null;
  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-border bg-background/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {n.pipelineStatus === "triage_failed"
          ? <Chip className="border-p0/40 text-p0">Triage failed: {n.triageError}</Chip>
          : <ImportanceBadge value={n.importance} />}
        <ActionBadge action={n.action} routeTo={n.routeTo} />
        <RiskFlags flags={n.riskFlags} />
        {n.limitedContext && <Chip className="text-muted">Limited context</Chip>}
        <SentimentDot value={n.sentiment} />
      </div>
      {n.reason && <p className="text-sm">{n.reason}</p>}
    </div>
  );
}

function Comment({ n, children, focusId }: { n: ThreadNode; children: React.ReactNode; focusId: string }) {
  const isMention = !!n.importance || n.pipelineStatus === "triage_failed";
  const focused = n.id === focusId;
  return (
    <li id={n.id} className="space-y-3">
      <div className={`rounded-2xl p-3 ${focused ? "ring-2 ring-accent-from" : ""} ${isMention ? "bg-surface" : ""}`}>
        <p className="text-xs text-muted">
          <span className="text-foreground/80">{n.author ?? "unknown"}</span> · {timeAgo(n.createdAt)} · ▲ {n.score ?? 0}
          {isMention && <span className="text-gradient font-medium"> · mention</span>}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{n.body}</p>
        <TriageBox n={n} />
      </div>
      {children}
    </li>
  );
}

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const thread = await getThread(id);
  if (!thread) notFound();
  const { post, comments, focusId } = thread;
  const focus = post?.id === focusId ? post : comments.find((c) => c.id === focusId) ?? null;
  const draft = focus ? await latestDraft(focus.id) : null;

  // Build the reply tree from parent ids. Comments whose parent we don't have go to the top level.
  const ids = new Set(comments.map((c) => c.redditId));
  const children = new Map<string, ThreadNode[]>();
  const roots: ThreadNode[] = [];
  for (const c of comments) {
    if (c.parentId && ids.has(c.parentId)) children.set(c.parentId, [...(children.get(c.parentId) ?? []), c]);
    else roots.push(c);
  }
  const render = (nodes: ThreadNode[]): React.ReactNode => (
    <ul className="space-y-3 border-l border-border pl-3 sm:pl-4">
      {nodes.map((n) => (
        <Comment key={n.id} n={n} focusId={focusId}>
          {children.has(n.redditId) ? render(children.get(n.redditId)!) : null}
        </Comment>
      ))}
    </ul>
  );

  const subreddit = post?.subreddit ?? comments[0]?.subreddit;
  const redditUrl = post?.url ?? comments.find((c) => c.id === focusId)?.url ?? null;

  return (
    <div className="space-y-6">
      <Link href="/queue" className="text-sm text-muted hover:text-foreground">← Queue</Link>

      <section className="rounded-3xl border border-border bg-surface p-4 sm:p-6">
        <p className="text-sm text-muted">
          r/{subreddit}
          {post && <> · {post.author ?? "unknown"} · {timeAgo(post.createdAt)} · ▲ {post.score ?? 0} · {post.numComments ?? 0} comments</>}
        </p>
        <h1 className="mt-2 text-xl font-semibold leading-snug sm:text-2xl">
          {post?.title ?? comments[0]?.title ?? "Thread not fetched"}
        </h1>
        {post?.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{post.body}</p>}
        {!post && (
          <p className="mt-3 text-sm text-muted">
            We only have the comment that mentioned the brand; the rest of this thread wasn&apos;t fetched (limited context).
          </p>
        )}
        {post && <TriageBox n={post} />}
        <div className="mt-4 flex flex-wrap gap-2">
          {redditUrl && (
            <a href={redditUrl} target="_blank" rel="noreferrer" className="rounded-full bg-surface-2 px-4 py-1.5 text-sm hover:bg-border">
              Open on Reddit ↗
            </a>
          )}
          {post && <FollowButton postId={post.id} initial={post.followed} />}
        </div>
      </section>

      {focus && (focus.importance || focus.pipelineStatus === "triage_failed") && (
        <ReplyPanel
          key={`${focus.id}:${draft?.id ?? "none"}`}
          mentionId={focus.id}
          redditUrl={focus.url}
          recommended={focus.action === "reply"}
          triageReason={focus.reason}
          replied={focus.userStatus === "replied"}
          draft={draft ? { ...draft, createdAt: draft.createdAt.toISOString(), checks: draft.checks as never } : null}
        />
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">
          {comments.length} stored comment{comments.length === 1 ? "" : "s"} · mentions are highlighted
        </h2>
        {comments.length > 0 && render(roots)}
      </section>
    </div>
  );
}
