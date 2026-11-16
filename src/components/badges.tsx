import { ACTIONS, FLAGS, IMPORTANCE, ROUTES, SENTIMENT } from "@/lib/labels";

export function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs ${className}`}>
      {children}
    </span>
  );
}

export function ImportanceBadge({ value }: { value: keyof typeof IMPORTANCE | null }) {
  if (!value) return <Chip className="text-muted">Untriaged</Chip>;
  const v = IMPORTANCE[value];
  return <Chip className={`font-medium ${v.className}`}>{v.label}</Chip>;
}

export function ActionBadge({ action, routeTo }: { action: keyof typeof ACTIONS | null; routeTo: string | null }) {
  if (!action) return null;
  const route = routeTo ? ROUTES[routeTo] ?? routeTo : null;
  const highlight = action === "reply" ? "border-accent-from/50 text-accent-from" : "text-foreground";
  return (
    <Chip className={highlight}>
      {ACTIONS[action]}
      {route && <span className="text-muted">→ {route}</span>}
    </Chip>
  );
}

export function SentimentDot({ value }: { value: number | null }) {
  if (value == null) return null;
  const s = SENTIMENT[String(value)] ?? SENTIMENT["0"];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={`Sentiment: ${s.label}`}>
      <span className={`h-2 w-2 rounded-full ${s.className}`} />
      {s.label}
    </span>
  );
}

export function RiskFlags({ flags }: { flags: string[] | null }) {
  if (!flags?.length) return null;
  return flags.map((f) => (
    <Chip key={f} className="border-p0/30 text-p0/90">⚑ {FLAGS[f] ?? f}</Chip>
  ));
}
