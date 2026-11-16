export function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/** Run `fn` over items with at most `concurrency` in flight. Errors are returned, not thrown. */
export async function pMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<({ ok: true; value: R } | { ok: false; error: unknown })[]> {
  const results: ({ ok: true; value: R } | { ok: false; error: unknown })[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { ok: true, value: await fn(items[i]) };
      } catch (error) {
        results[i] = { ok: false, error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export function truncate(s: string | null | undefined, max: number) {
  if (!s) return "";
  return s.length <= max ? s : `${s.slice(0, max)}… [truncated]`;
}

/** A point in time after which long-running steps stop starting new work. */
export class Deadline {
  constructor(private readonly at: number) {}
  static in(ms: number) { return new Deadline(Date.now() + ms); }
  get passed() { return Date.now() >= this.at; }
  get remainingMs() { return Math.max(0, this.at - Date.now()); }
}

/**
 * Shorten long text without losing the part that matters: keep the start, then
 * a window around each match of `focus` (e.g. the brand name). Plain truncation
 * hid "…100% on my Peloton" at character 1,400 of a long post.
 */
export function excerpt(text: string | null | undefined, max: number, focus: RegExp | null, window = 200) {
  if (!text) return "";
  if (text.length <= max || !focus) return truncate(text, max);
  const head = Math.floor(max / 3);
  const ranges: [number, number][] = [[0, head]];
  const re = new RegExp(focus.source, focus.flags.includes("g") ? focus.flags : `${focus.flags}g`);
  for (const m of text.matchAll(re)) {
    const start = Math.max(0, m.index - window), end = Math.min(text.length, m.index + m[0].length + window);
    const last = ranges[ranges.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else ranges.push([start, end]);
  }
  let out = "", used = 0;
  for (const [s, e] of ranges) {
    if (used >= max) break;
    const piece = text.slice(s, Math.min(e, s + (max - used)));
    out += (s > 0 ? " […] " : "") + piece;
    used += piece.length;
  }
  return used < text.length ? `${out} […]` : out;
}
