// Pure renderers for the daily digest and the spike alert (unit-tested).
// One email a day, all brands: do I need to act, where, how important.
// Plain, light layout with inline styles only (what email clients reliably support).
import { URGENCY, nextStep } from "@/lib/labels";
import { esc } from "./send";

export type DigestItem = {
  id: string;
  importance: "P0" | "P1" | "P2" | "P3";
  action: "reply" | "route" | "monitor" | "ignore";
  routeTo: string | null;
  subreddit: string;
  reason: string;
  isNew: boolean;
};

export type DigestBrand = {
  id: string;
  name: string;
  counts: { P0: number; P1: number; P2: number; replies: number };
  spikes: { id: string; title: string; subreddit: string; reason: string; negative: boolean; simulated: boolean }[];
  items: DigestItem[];
  newToday: number;
};

const C = { text: "#18181b", muted: "#71717a", line: "#e4e4e7", link: "#2563eb", spike: "#ea580c" };
const DOT = { P0: "#ef4444", P1: "#f97316", P2: "#eab308", P3: "#a1a1aa" } as const;
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MAX_ITEMS = 8;

const mentionUrl = (app: string, brandId: string, id: string) => `${app}/b/${brandId}/m/${id}`;

function shell(preheader: string, body: string, app: string) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#ffffff">` +
    `<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>` +
    `<div style="font-family:${FONT};color:${C.text};max-width:560px;margin:0 auto;padding:32px 20px;font-size:14px;line-height:1.5">` +
    `<p style="margin:0 0 24px;font-size:13px;font-weight:600;letter-spacing:-0.01em">Brand Pulse</p>` +
    body +
    `<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid ${C.line};font-size:12px;color:${C.muted}">` +
    `Nothing is ever posted for you. <a href="${app}" style="color:${C.muted}">Open Brand Pulse</a></p>` +
    `</div></body></html>`;
}

/** One clickable row: dot, label, what to do, and the reason underneath. */
function row(href: string, dot: string, label: string, meta: string, reason: string) {
  return `<a href="${href}" style="display:block;text-decoration:none;color:${C.text};padding:12px 0;border-top:1px solid ${C.line}">` +
    `<span style="font-size:13px"><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${dot};margin-right:8px"></span>` +
    `<b>${esc(label)}</b> <span style="color:${C.muted}">· ${esc(meta)}</span></span><br>` +
    `<span style="display:block;margin-top:2px">${esc(reason)}</span></a>`;
}

/** "2026-11-16" → "Monday, November 16" */
export function prettyDate(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? date
    : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

export function digestSubject(brands: DigestBrand[], date: string) {
  const p0 = brands.reduce((n, b) => n + b.counts.P0 + b.spikes.length, 0);
  const p1 = brands.reduce((n, b) => n + b.counts.P1, 0);
  if (p0 + p1 === 0) return `Reddit digest ${date}: nothing urgent`;
  return `Reddit digest ${date}: ${[p0 && `${p0} urgent`, p1 && `${p1} for today`].filter(Boolean).join(", ")}`;
}

export function renderDigest(brands: DigestBrand[], date: string, app: string) {
  const quiet = brands.every((b) => b.counts.P0 + b.counts.P1 + b.counts.P2 + b.spikes.length === 0);
  const intro = quiet ? "Quiet day. Nothing needs you." : "Here's what needs you, most urgent first.";
  const text: string[] = [`Reddit digest for ${date}`, "", intro, ""];
  const html: string[] = [
    `<h1 style="margin:0;font-size:22px;font-weight:600;letter-spacing:-0.02em">${esc(prettyDate(date))}</h1>`,
    `<p style="margin:4px 0 0;color:${C.muted}">${intro}</p>`,
  ];

  for (const b of brands) {
    const open = b.counts.P0 + b.counts.P1 + b.counts.P2;
    const summary = open + b.spikes.length === 0
      ? `All clear · ${b.newToday} new in 24h`
      : `${open} to look at · ${b.newToday} new in 24h`;
    html.push(`<h2 style="margin:32px 0 2px;font-size:16px;font-weight:600">` +
      `<a href="${app}/b/${b.id}" style="color:${C.text};text-decoration:none">${esc(b.name)}</a></h2>` +
      `<p style="margin:0 0 12px;font-size:13px;color:${C.muted}">${summary}</p>`);
    text.push(b.name, summary);

    for (const s of b.spikes) {
      const label = `${s.negative ? "Negative thread blowing up" : "Thread blowing up"}${s.simulated ? " (demo)" : ""}`;
      html.push(row(mentionUrl(app, b.id, s.id), C.spike, label, `r/${s.subreddit}`,
        `${s.title}. Agree one response with the client before anyone replies.`));
      text.push(`- ${label} · r/${s.subreddit}: ${s.title} ${mentionUrl(app, b.id, s.id)}`);
    }
    const shown = b.items.slice(0, MAX_ITEMS);
    for (const i of shown) {
      const label = URGENCY[i.importance].label;
      const meta = [nextStep(i.action, i.routeTo), `r/${i.subreddit}`, i.isNew && "new"].filter(Boolean).join(" · ");
      html.push(row(mentionUrl(app, b.id, i.id), DOT[i.importance], label, meta, i.reason));
      text.push(`- [${label}] ${meta}: ${i.reason} ${mentionUrl(app, b.id, i.id)}`);
    }
    if (b.items.length > shown.length) {
      const more = b.items.length - shown.length;
      html.push(`<p style="margin:0;padding-top:12px;border-top:1px solid ${C.line};font-size:13px">` +
        `<a href="${app}/b/${b.id}" style="color:${C.link};text-decoration:none">${more} more in the inbox →</a></p>`);
      text.push(`+${more} more: ${app}/b/${b.id}`);
    }
    text.push("");
  }
  return { html: shell(intro, html.join(""), app), text: text.join("\n") };
}

export function renderSpikeAlert(a: {
  brand: string; brandId: string; id: string; title: string; subreddit: string; reason: string; negative: boolean; simulated: boolean;
}, app: string) {
  const label = `${a.negative ? "Negative thread blowing up" : "Thread blowing up"}${a.simulated ? " (simulated demo)" : ""}`;
  const url = mentionUrl(app, a.brandId, a.id);
  const body =
    `<p style="margin:0;font-size:13px;color:${C.spike};font-weight:600">${esc(label)} · ${esc(a.brand)}</p>` +
    `<h1 style="margin:6px 0 4px;font-size:20px;font-weight:600;letter-spacing:-0.02em">${esc(a.title)}</h1>` +
    `<p style="margin:0 0 16px;color:${C.muted}">r/${esc(a.subreddit)} · ${esc(a.reason)}</p>` +
    `<p style="margin:0 0 24px">Don't reply comment by comment. Agree one response with the client first.</p>` +
    `<a href="${url}" style="display:inline-block;background:${C.text};color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:500">Open the thread</a>`;
  return {
    subject: `${a.brand}: ${label.toLowerCase()} in r/${a.subreddit}`,
    html: shell(`${a.title} · r/${a.subreddit}`, body, app),
    text: `${label} for ${a.brand} in r/${a.subreddit}: ${a.title}\n${a.reason}.\nDon't reply comment by comment; agree one response with the client first.\n${url}`,
  };
}
