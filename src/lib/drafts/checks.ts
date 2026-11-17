// Deterministic tone checks on every draft. They don't block anything:
// a failing draft is shown with the reason, so the human decides (never hidden).
export type Check = { id: string; label: string; level: "pass" | "warn" | "fail"; detail?: string };

export type CheckContext = {
  brandName: string;
  allowedHosts: string[]; // e.g. support.onepeloton.com, onepeloton.com
  threadFlags: string[]; // triage risk flags of the item
};

const RULES: { id: string; label: string; level: "warn" | "fail"; re: RegExp; detail: string; negatable?: boolean }[] = [
  { id: "promises", label: "No promises", level: "fail", negatable: true,
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
  { id: "ai_tone", label: "Sounds human", level: "warn",
    re: /(understand (your|the|how) frustrat\w*|we hear you|rest assured|don't hesitate|feel free to|happy to help|thanks for (sharing|reaching out|bringing)|great question|hey there|we appreciate your|—)/i,
    detail: "Stock phrasing that reads as AI or a support macro" },
  { id: "blame", label: "No blaming partners", level: "warn",
    re: /\b((apple|garmin|strava|fitbit|the contractor|the delivery partner)'s fault|(caused|broken) by (apple|garmin|strava|fitbit|the contractor)|(on|from) (apple|garmin|strava|fitbit)'s (side|end))\b/i,
    detail: "Blames a partner for the problem" },
];

const URL_RE = /\bhttps?:\/\/[^\s)]+|\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|net|org|io|co|app)\b[^\s)]*/gi;
const EMOJI_RE = /\p{Extended_Pictographic}/u;

// "I can't promise a date" or "no refund yet" is the opposite of a promise.
const NEGATION = /\b(can't|cannot|can not|won't|couldn't|not|no|never|without)\b[^.!?]{0,20}$/i;

/** First match of `re` in `text`, skipping negated ones when `negatable`. */
function firstMatch(text: string, re: RegExp, negatable = false) {
  for (const m of text.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))) {
    if (negatable && NEGATION.test(text.slice(0, m.index))) continue;
    return m[0];
  }
  return null;
}

export function checkDraft(text: string, ctx: CheckContext): Check[] {
  const checks: Check[] = [];
  const t = text.trim();

  checks.push(t.length <= 400
    ? { id: "length", label: "Short", level: "pass", detail: `${t.length} characters` }
    : { id: "length", label: "Short", level: t.length <= 600 ? "warn" : "fail", detail: `${t.length} characters. Aim for under 400.` });

  const badLinks = [...t.matchAll(URL_RE)].map((m) => m[0])
    .filter((u) => !ctx.allowedHosts.some((h) => u.toLowerCase().replace(/^https?:\/\//, "").startsWith(h)));
  checks.push(badLinks.length
    ? { id: "links", label: "Only official links", level: "fail", detail: `Unapproved link: ${badLinks.join(", ")}` }
    : { id: "links", label: "Only official links", level: "pass" });

  for (const r of RULES) {
    const m = firstMatch(t, r.re, r.negatable);
    checks.push(m ? { id: r.id, label: r.label, level: r.level, detail: `${r.detail}: “${m}”` } : { id: r.id, label: r.label, level: "pass" });
  }

  const bangs = (t.match(/!/g) ?? []).length;
  const emoji = EMOJI_RE.test(t);
  checks.push(bangs > 1 || emoji
    ? { id: "calm", label: "Calm punctuation", level: "warn", detail: [bangs > 1 && `${bangs} exclamation marks`, emoji && "emoji"].filter(Boolean).join(", ") }
    : { id: "calm", label: "Calm punctuation", level: "pass" });

  if (new RegExp(`${ctx.brandName} team\\.?\\s*$`, "i").test(t)) {
    checks.push({ id: "signoff", label: "No signature", level: "warn", detail: "The account name already shows who's replying" });
  }

  const placeholders = [...t.matchAll(/\[[^\]]{2,30}\]/g)].map((m) => m[0]);
  if (placeholders.length) checks.push({ id: "placeholders", label: "No unfilled placeholders", level: "warn", detail: placeholders.join(", ") });

  if (ctx.threadFlags.includes("named_staff")) {
    checks.push({ id: "staff", label: "Thread mentions named staff", level: "warn", detail: "Make sure the reply doesn't comment on them" });
  }
  return checks;
}

export function worstLevel(checks: Check[]): Check["level"] {
  return checks.some((c) => c.level === "fail") ? "fail" : checks.some((c) => c.level === "warn") ? "warn" : "pass";
}

/** Removes a trailing sign-off ("— Sam, Peloton team") and em dashes, in case the model adds them anyway. */
export function tidyReply(text: string, brandName: string) {
  const brand = brandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const signOff = new RegExp(`(?:^|\\n|[—–-])\\s*(?:\\[?[\\p{L} ]{1,30}\\]?,?\\s+)?(?:the\\s+)?${brand}\\s+team\\.?\\s*$`, "iu");
  return text.trim().replace(signOff, "").trim().replace(/\s*—\s*/g, ", ");
}
