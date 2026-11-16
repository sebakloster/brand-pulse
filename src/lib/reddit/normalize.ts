// Validate raw Apify items (harshmaur/reddit-scraper) and turn them into one
// shape for posts and comments. Unknown fields stay in raw_items.
import { z } from "zod";

const str = z.string();
const optStr = z.string().nullish();
const optNum = z.number().nullish();

const PostItem = z.object({
  dataType: z.literal("post"),
  parsedId: str,
  title: optStr,
  body: optStr,
  authorName: optStr,
  parsedCommunityName: str,
  postUrl: optStr,
  createdAt: str,
  score: optNum,
  upVotes: optNum,
  commentsCount: optNum,
  upvoteRatio: optNum,
  commentsPerHour: optNum,
  stickied: z.boolean().nullish(),
  distinguished: optStr,
  removalStatus: optStr,
  crawledAt: optStr,
}).loose();

const CommentItem = z.object({
  dataType: z.literal("comment"),
  id: str,
  parsedPostId: str,
  parsedParentId: optStr,
  parentKind: optStr, // "post" | "comment"
  depth: optNum,
  body: optStr,
  authorName: optStr,
  subredditName: str,
  url: optStr,
  commentCreatedAt: str,
  score: optNum,
  stickied: z.boolean().nullish(),
  distinguished: optStr,
  postTitle: optStr, // only on comments that came from comment search; don't rely on it
  crawledAt: optStr,
}).loose();

export const RawItem = z.discriminatedUnion("dataType", [PostItem, CommentItem]);
export type RawItem = z.infer<typeof RawItem>;

export type NormalizedMention = {
  redditId: string; // t3_<id> for posts, t1_<id> for comments
  kind: "post" | "comment";
  postId: string; // t3_<id>
  parentId: string | null;
  depth: number;
  subreddit: string; // lowercase, no "r/"
  author: string | null;
  title: string | null; // post title; for comments, the post title when the Actor provides it
  body: string | null;
  url: string | null;
  createdAtReddit: Date;
  score: number | null;
  numComments: number | null;
  upvoteRatio: number | null;
  commentsPerHour: number | null;
  isBotLike: boolean;
  isDeleted: boolean;
  crawledAt: Date | null; // when the scraper saw it (snapshot time)
};

const DELETED = new Set(["[deleted]", "[removed]"]);
const BOT_AUTHORS = new Set(["automoderator"]);

export function normalize(item: RawItem): NormalizedMention {
  const author = item.authorName ?? null;
  const isBotLike =
    BOT_AUTHORS.has((author ?? "").toLowerCase()) || item.distinguished === "moderator" || item.stickied === true;

  if (item.dataType === "post") {
    const body = item.body ?? null;
    return {
      redditId: `t3_${item.parsedId}`,
      kind: "post",
      postId: `t3_${item.parsedId}`,
      parentId: null,
      depth: 0,
      subreddit: item.parsedCommunityName.toLowerCase(),
      author,
      title: item.title ?? null,
      body,
      url: item.postUrl ?? null,
      createdAtReddit: new Date(item.createdAt),
      score: item.score ?? item.upVotes ?? null,
      numComments: item.commentsCount ?? null,
      upvoteRatio: item.upvoteRatio ?? null,
      commentsPerHour: item.commentsPerHour ?? null,
      isBotLike,
      crawledAt: item.crawledAt ? new Date(item.crawledAt) : null,
      isDeleted:
        (item.removalStatus != null && item.removalStatus !== "active") ||
        DELETED.has((body ?? "").trim()) ||
        DELETED.has((item.title ?? "").trim()),
    };
  }

  const body = item.body ?? null;
  const parentIsPost = item.parentKind !== "comment";
  return {
    redditId: `t1_${item.id}`,
    kind: "comment",
    postId: `t3_${item.parsedPostId}`,
    parentId: item.parsedParentId
      ? `${parentIsPost ? "t3" : "t1"}_${item.parsedParentId}`
      : `t3_${item.parsedPostId}`,
    depth: item.depth ?? 0,
    subreddit: item.subredditName.replace(/^r\//i, "").toLowerCase(),
    author,
    title: item.postTitle ?? null,
    body,
    url: item.url ?? null,
    createdAtReddit: new Date(item.commentCreatedAt),
    score: item.score ?? null,
    numComments: null,
    upvoteRatio: null,
    commentsPerHour: null,
    isBotLike,
    crawledAt: item.crawledAt ? new Date(item.crawledAt) : null,
    isDeleted: DELETED.has((body ?? "").trim()) || author === "[deleted]",
  };
}

export type ParseResult =
  | { ok: true; redditId: string; mention: NormalizedMention; raw: unknown }
  | { ok: false; redditId: string | null; error: string; raw: unknown };

export function parseItem(raw: unknown): ParseResult {
  const r = RawItem.safeParse(raw);
  if (!r.success) {
    const anyRaw = raw as Record<string, unknown> | null;
    const id = typeof anyRaw?.id === "string" ? anyRaw.id : null;
    return { ok: false, redditId: id, error: z.prettifyError(r.error), raw };
  }
  const mention = normalize(r.data);
  return { ok: true, redditId: mention.redditId, mention, raw };
}
