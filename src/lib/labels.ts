// Plain-language labels for everything the UI shows. No internal codes (P0–P3,
// "route", "named_staff") ever reach the screen.

export type Importance = "P0" | "P1" | "P2" | "P3";
export type Action = "reply" | "route" | "monitor" | "ignore";

export const URGENCY: Record<Importance, { label: string; dot: string; color: "danger" | "warning" | "default" }> = {
  P0: { label: "Urgent", dot: "bg-danger", color: "danger" },
  P1: { label: "Today", dot: "bg-warning", color: "warning" },
  P2: { label: "When you can", dot: "bg-accent", color: "default" },
  P3: { label: "FYI", dot: "bg-muted", color: "default" },
};

const TEAMS: Record<string, string> = {
  support: "support",
  product: "product",
  content_talent: "the content team",
  security: "security",
  legal: "legal",
  marketing: "marketing",
  partnerships: "partnerships",
  pr_comms: "PR",
};

/** What the person should do, in one short phrase. */
export function nextStep(action: Action | null, routeTo: string | null) {
  switch (action) {
    case "reply": return "Reply suggested";
    case "route": return routeTo ? `Pass to ${TEAMS[routeTo] ?? routeTo}` : "Pass to the right team";
    case "monitor": return "Keep an eye on it";
    case "ignore": return "No action needed";
    default: return "Needs a look";
  }
}

/** Why to be careful, in plain words (only shown on the item page). */
export const HEADS_UP: Record<string, string> = {
  safety_medical: "Health or safety topic",
  legal: "Possible legal issue",
  security_privacy: "Security or privacy issue",
  named_staff: "Mentions a staff member",
  crisis_signal: "Could escalate",
  competitor: "Mentions a competitor",
  misinformation: "Contains a false claim",
};

export function sentimentWord(s: number | null) {
  if (s == null) return null;
  return s <= -2 ? "Very negative" : s === -1 ? "Negative" : s === 0 ? "Neutral" : s === 1 ? "Positive" : "Very positive";
}

export function timeAgo(iso: string | Date, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** Brand logo from its website (favicon service); the UI falls back to an initial. */
export function logoUrl(domain: string | null | undefined) {
  if (!domain) return undefined;
  const host = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

// Why something was closed; stored with the item (and useful as evaluation data).
export const DISCARD_REASONS = {
  not_about_brand: "Not about the brand",
  not_worth_it: "Not worth attention",
  already_handled: "Already handled",
} as const;
export type DiscardReason = keyof typeof DISCARD_REASONS;
