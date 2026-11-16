// Display labels shared by server and client components.
export const DISCARD_REASONS = {
  not_about_brand: "Not about the brand",
  not_worth_it: "Not worth attention",
  already_handled: "Already handled",
} as const;
export type DiscardReason = keyof typeof DISCARD_REASONS;

export const IMPORTANCE = {
  P0: { label: "P0 · Act now", className: "bg-p0/15 text-p0 border-p0/40" },
  P1: { label: "P1 · Today", className: "bg-p1/15 text-p1 border-p1/40" },
  P2: { label: "P2 · When possible", className: "bg-p2/15 text-p2 border-p2/40" },
  P3: { label: "P3 · Info", className: "bg-p3/15 text-muted border-p3/40" },
} as const;

export const ACTIONS = { reply: "Reply", route: "Route", monitor: "Monitor", ignore: "Ignore" } as const;

export const ROUTES: Record<string, string> = {
  support: "Support", product: "Product", content_talent: "Content & talent", security: "Security",
  legal: "Legal", marketing: "Marketing", partnerships: "Partnerships", pr_comms: "PR & comms",
};

export const FLAGS: Record<string, string> = {
  safety_medical: "Safety / medical", legal: "Legal", security_privacy: "Security / privacy",
  named_staff: "Named staff", crisis_signal: "Crisis signal", competitor: "Competitor", misinformation: "Misinformation",
};

export const SENTIMENT: Record<string, { label: string; className: string }> = {
  "-2": { label: "Very negative", className: "bg-p0" },
  "-1": { label: "Negative", className: "bg-p1" },
  "0": { label: "Neutral", className: "bg-p3" },
  "1": { label: "Positive", className: "bg-accent-to/70" },
  "2": { label: "Very positive", className: "bg-accent-to" },
};

export function timeAgo(iso: string | Date, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
