import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@heroui/react";
import { ArrowUpRightFromSquare, ChevronLeft, TriangleExclamation } from "@gravity-ui/icons";
import { Conversation } from "@/components/conversation";
import { ItemActions } from "@/components/item-actions";
import { ReplySection } from "@/components/reply-section";
import { latestDraft } from "@/lib/drafts/generate";
import { HEADS_UP, URGENCY, nextStep, sentimentWord, timeAgo } from "@/lib/labels";
import { getThread } from "@/lib/queries";

export const metadata = { title: "Mention · Brand Pulse" };

export default async function ItemPage({ params }: { params: Promise<{ brandId: string; id: string }> }) {
  const { brandId, id } = await params;
  const thread = await getThread(id);
  if (!thread?.item || thread.brandId !== brandId) notFound();
  const { item, post, comments } = thread;
  const draft = await latestDraft(item.id);
  const u = item.importance ? URGENCY[item.importance] : null;
  const open = item.userStatus === "open";
  const spiking = post?.threadSpiking ?? false;
  const recommended = item.action === "reply" && !spiking;
  const why = spiking
    ? "This thread is blowing up. Agree one response with the client before anyone replies."
    : "A reply isn't recommended here.";
  const isPost = item.kind === "post";
  const redditUrl = item.url ?? post?.url ?? null;

  return (
    <div className="space-y-6">
      <Link href={`/b/${brandId}`} className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground">
        <ChevronLeft className="size-4" /> Inbox
      </Link>

      <section className="animate-rise space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {u && <span className={`size-2 rounded-full ${u.dot}`} />}
          {u && <span className="font-medium">{u.label}</span>}
          <span className="text-muted">· {nextStep(item.action, item.routeTo)}</span>
          {sentimentWord(item.sentiment) && <span className="text-muted">· {sentimentWord(item.sentiment)}</span>}
        </div>
        <h2 className="text-xl font-semibold leading-snug tracking-tight">
          {item.reason ?? (item.triageError ? "This mention couldn't be analyzed automatically." : "")}
        </h2>
        {(item.riskFlags?.length ?? 0) > 0 && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-warning">
            <TriangleExclamation className="size-4" />
            {item.riskFlags!.map((f) => HEADS_UP[f] ?? f).join(" · ")}
          </p>
        )}
      </section>

      <Card className="animate-rise" style={{ animationDelay: "60ms" }}>
        <Card.Content className="space-y-3">
          <p className="text-xs text-muted">
            {isPost ? "Post" : "Comment"} by {item.author ?? "someone"} in r/{item.subreddit} · {timeAgo(item.createdAt)}
          </p>
          {(isPost || post?.title || item.title) && (
            <p className="font-medium">{isPost ? item.title : post?.title ?? item.title}</p>
          )}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{item.body}</p>
          {redditUrl && (
            <a href={redditUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
              View on Reddit <ArrowUpRightFromSquare className="size-3.5" />
            </a>
          )}
        </Card.Content>
      </Card>

      <section className="animate-rise space-y-3" style={{ animationDelay: "120ms" }}>
        <h3 className="text-sm font-medium text-muted">Reply</h3>
        <ReplySection
          key={draft?.id ?? "none"}
          recommended={recommended}
          why={why}
          mentionId={item.id}
          redditUrl={redditUrl}
          replied={item.userStatus === "replied"}
          draft={draft ? { id: draft.id, finalText: draft.finalText, checks: draft.checks as never } : null}
        />
      </section>

      <div className="animate-rise border-t border-separator pt-5" style={{ animationDelay: "160ms" }}>
        <ItemActions id={item.id} brandId={brandId} open={open} primary={!recommended} />
      </div>

      <Conversation comments={isPost ? comments : comments.filter((c) => c.id !== item.id).length ? comments : []} focusId={item.id} />
    </div>
  );
}
