// Deterministic tone checks on every draft. They don't block anything:
// a failing draft is shown with the reason, so the human decides (never hidden).
export type Check = { id: string; label: string; level: "pass" | "warn" | "fail"; detail?: string };

export type CheckContext = {
  brandName: string;
  allowedHosts: string[]; // e.g. support.onepeloton.com, onepeloton.com
  threadFlags: string[]; // triage risk flags of the item
};

const RULES: { id: string; label: string; level: "warn" | "fail"; re: RegExp; detail: string }[] = [
  { id: "promises", label: "No promises", level: "fail",
    re: /\b(guarantee[ds]?|promise|will (definitely )?be fixed|refund(ed)?|credit (your|the) account|free (month|replacement|upgrade)|by (tomorrow|monday|tuesday|wednesday|thursday|friday|next week))\b/i,
    detail: "Promises an outcome we can't guarantee" },
  { id: "medical", label: "No health or body advice", level: "fail",
    re: /\b(weight|calorie|diet|injur(y|ies|ed)|doctor|physio|rehab|heal|pain|pounds|lbs|body ?fat)\b/i,
    detail: "Touches health, injury or body topics" },
  { id: "marketing", label: "No marketing", level: "fail",
    re: /\b(check out our|black friday|cyber monday|on sale|discount|promo(tion)?|deal|limited[- ]time|subscribe)\b/i,
    detail: "Reads like promotion" },
  { id: "sensitive", label: "No account details in public", level: "fail",
    re: /\b(share|send|post|give|reply with|tell us)\b[^.]{0,40}\b(password|card number|credit card|full address|phone number)\b/i,
    detail: "Asks for sensitive details in a public thread" },
  { id: "corporate", label: "Human tone", level: "warn",
    re: /(apologi[sz]e for (any|the) inconvenience|valued (customer|member)|we take (this|your concern) (very )?seriously|as per|kindly)/i,
    detail: "Corporate phrasing" },
  { id: "blame", label: "No blaming partners", level: "warn",
    re: /\b((apple|garmin|strava|fitbit|the contractor|the delivery partner)'s fault|(caused|broken) by (apple|garmin|strava|fitbit|the contractor)|(on|from) (apple|garmin|strava|fitbit)'s (side|end))\b/i,
    detail: "Blames a partner for the problem" },
];

const URL_RE = /\bhttps?:\/\/[^\s)]+|\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|net|org|io|co|app)\b[^\s)]*/gi;
const EMOJI_RE = /\p{Extended_Pictographic}/u;

export function checkDraft(text: string, ctx: CheckContext): Check[] {
  const checks: Check[] = [];
  const t = text.trim();

  checks.push(t.length <= 600
    ? { id: "length", label: "Short (Reddit-length)", level: t.length <= 500 ? "pass" : "warn", detail: `${t.length} characters` }
    : { id: "length", label: "Short (Reddit-length)", level: "fail", detail: `${t.length} characters (max 600)` });

  const badLinks = [...t.matchAll(URL_RE)].map((m) => m[0])
    .filter((u) => !ctx.allowedHosts.some((h) => u.toLowerCase().replace(/^https?:\/\//, "").startsWith(h)));
  checks.push(badLinks.length
    ? { id: "links", label: "Only official links", level: "fail", detail: `Unapproved link: ${badLinks.join(", ")}` }
    : { id: "links", label: "Only official links", level: "pass" });

  for (const r of RULES) {
    const m = t.match(r.re);
    checks.push(m ? { id: r.id, label: r.label, level: r.level, detail: `${r.detail}: “${m[0]}”` } : { id: r.id, label: r.label, level: "pass" });
  }

  const bangs = (t.match(/!/g) ?? []).length;
  const emoji = EMOJI_RE.test(t);
  checks.push(bangs > 1 || emoji
    ? { id: "calm", label: "Calm punctuation", level: "warn", detail: [bangs > 1 && `${bangs} exclamation marks`, emoji && "emoji"].filter(Boolean).join(", ") }
    : { id: "calm", label: "Calm punctuation", level: "pass" });

  const signOff = new RegExp(`${ctx.brandName} team\\s*$`, "i").test(t);
  checks.push({ id: "signoff", label: "Signed by a person", level: signOff ? "pass" : "warn", detail: signOff ? undefined : `End with "— [first name], ${ctx.brandName} team"` });

  const placeholders = [...t.matchAll(/\[(?!first name\])[^\]]{2,30}\]/gi)].map((m) => m[0]);
  if (placeholders.length) checks.push({ id: "placeholders", label: "No unfilled placeholders", level: "warn", detail: placeholders.join(", ") });

  if (ctx.threadFlags.includes("named_staff")) {
    checks.push({ id: "staff", label: "Thread mentions named staff", level: "warn", detail: "Make sure the reply doesn't comment on them" });
  }
  return checks;
}

export function worstLevel(checks: Check[]): Check["level"] {
  return checks.some((c) => c.level === "fail") ? "fail" : checks.some((c) => c.level === "warn") ? "warn" : "pass";
}
