// Pure renderers for the daily digest and the spike alert (unit-tested).
// One email a day, all brands: do I need to act, where, how important.
import { ACTIONS, ROUTES } from "@/lib/labels";
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
  name: string;
  counts: { P0: number; P1: number; P2: number; replies: number };
  spikes: { id: string; title: string; subreddit: string; reason: string; negative: boolean; simulated: boolean }[];
  items: DigestItem[];
  newToday: number;
};

const COLORS = { P0: "#ef4444", P1: "#f97316", P2: "#eab308", P3: "#71717a" } as const;
const MAX_ITEMS = 8;

function actionText(i: Pick<DigestItem, "action" | "routeTo">) {
  const route = i.routeTo ? ROUTES[i.routeTo] ?? i.routeTo : null;
  return route ? `${ACTIONS[i.action]} → ${route}` : ACTIONS[i.action];
}

export function digestSubject(brands: DigestBrand[], date: string) {
  const p0 = brands.reduce((n, b) => n + b.counts.P0 + b.spikes.length, 0);
  const p1 = brands.reduce((n, b) => n + b.counts.P1, 0);
  if (p0 + p1 === 0) return `Reddit digest ${date}: nothing urgent`;
  return `Reddit digest ${date}: ${[p0 && `${p0} act now`, p1 && `${p1} today`].filter(Boolean).join(", ")}`;
}

export function renderDigest(brands: DigestBrand[], date: string, app: string) {
  const quiet = brands.every((b) => b.counts.P0 + b.counts.P1 + b.counts.P2 + b.spikes.length === 0);
  const text: string[] = [`Reddit digest for ${date}`, ""];
  const html: string[] = [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#000;color:#f4f4f5;padding:24px;max-width:640px;margin:auto">`,
    `<h1 style="font-size:20px;margin:0 0 4px">Reddit digest · ${esc(date)}</h1>`,
    quiet
      ? `<p style="color:#a1a1aa">Quiet day: nothing needs you. (This email still arrives so silence never means "broken".)</p>`
      : `<p style="color:#a1a1aa">What needs attention across ${brands.length} brand${brands.length === 1 ? "" : "s"}, most urgent first.</p>`,
  ];
  if (quiet) text.push("Quiet day: nothing needs you.", "");

  for (const b of brands) {
    const summary = `${b.counts.P0} act now · ${b.counts.P1} today · ${b.counts.P2} when possible · ${b.counts.replies} reply suggestions · ${b.newToday} new in 24h`;
    html.push(`<h2 style="font-size:16px;margin:24px 0 4px">${esc(b.name)}</h2><p style="color:#a1a1aa;margin:0 0 12px;font-size:13px">${summary}</p>`);
    text.push(`== ${b.name} ==`, summary);
    for (const s of b.spikes) {
      const label = `${s.negative ? "NEGATIVE SPIKE" : "SPIKE"}${s.simulated ? " (simulated demo)" : ""}`;
      html.push(`<div style="border:1px solid #f97316;border-radius:12px;padding:10px 12px;margin:0 0 8px">` +
        `<b style="color:#f97316">🔥 ${label}</b> · r/${esc(s.subreddit)}<br>${esc(s.title)}<br>` +
        `<span style="color:#a1a1aa">${esc(s.reason)}. Agree a holding statement before replying.</span> ` +
        `<a style="color:#3b82f6" href="${app}/m/${s.id}">Open</a></div>`);
      text.push(`[${label}] r/${s.subreddit}: ${s.title} (${s.reason}) ${app}/m/${s.id}`);
    }
    const shown = b.items.slice(0, MAX_ITEMS);
    for (const i of shown) {
      html.push(`<div style="border:1px solid #27272a;border-radius:12px;padding:10px 12px;margin:0 0 8px">` +
        `<b style="color:${COLORS[i.importance]}">${i.importance}</b> · ${esc(actionText(i))} · r/${esc(i.subreddit)}${i.isNew ? " · <b>new</b>" : ""}<br>` +
        `${esc(i.reason)} <a style="color:#3b82f6" href="${app}/m/${i.id}">Open</a></div>`);
      text.push(`[${i.importance}] ${actionText(i)} · r/${i.subreddit}${i.isNew ? " · new" : ""}: ${i.reason} ${app}/m/${i.id}`);
    }
    if (b.items.length > shown.length) {
      html.push(`<p style="font-size:13px"><a style="color:#3b82f6" href="${app}/queue">+${b.items.length - shown.length} more in the queue</a></p>`);
      text.push(`+${b.items.length - shown.length} more: ${app}/queue`);
    }
    text.push("");
  }
  html.push(`<p style="color:#71717a;font-size:12px;margin-top:24px">Drafts are never posted automatically. <a style="color:#3b82f6" href="${app}/queue">Open the queue</a></p></div>`);
  return { html: html.join("\n"), text: text.join("\n") };
}

export function renderSpikeAlert(a: { brand: string; id: string; title: string; subreddit: string; reason: string; negative: boolean; simulated: boolean }, app: string) {
  const label = `${a.negative ? "Negative spike" : "Thread spiking"}${a.simulated ? " (simulated demo)" : ""}`;
  return {
    subject: `🔥 ${a.brand}: ${label} in r/${a.subreddit}`,
    html: `<div style="font-family:system-ui,sans-serif;background:#000;color:#f4f4f5;padding:24px;max-width:640px;margin:auto">` +
      `<h1 style="font-size:18px;color:#f97316;margin:0 0 8px">🔥 ${esc(label)} · ${esc(a.brand)}</h1>` +
      `<p style="margin:0 0 4px">r/${esc(a.subreddit)}: <b>${esc(a.title)}</b></p>` +
      `<p style="color:#a1a1aa">${esc(a.reason)}.</p>` +
      `<p>Don't reply comment by comment. Agree one holding statement with the client first.</p>` +
      `<p><a style="color:#3b82f6" href="${app}/m/${a.id}">Open the thread</a></p></div>`,
    text: `${label} for ${a.brand} in r/${a.subreddit}: ${a.title}\n${a.reason}.\nDon't reply comment by comment; agree one holding statement first.\n${app}/m/${a.id}`,
  };
}
