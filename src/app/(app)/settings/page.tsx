import { Button, Card } from "@heroui/react";
import { AppSettingsForm } from "@/components/app-settings-form";
import { logout } from "@/app/login/actions";
import { getSettings } from "@/lib/email/digest";
import { emailConfigured } from "@/lib/email/send";
import { timeAgo } from "@/lib/labels";

export const metadata = { title: "Settings · Brand Pulse" };

export default async function SettingsPage() {
  const s = await getSettings();
  return (
    <div className="space-y-6">
      <h1 className="animate-rise text-2xl font-semibold tracking-tight">Settings</h1>

      <Card className="animate-rise" style={{ animationDelay: "60ms" }}>
        <Card.Header>
          <Card.Title>Email</Card.Title>
          <Card.Description>
            {!emailConfigured()
              ? "Email isn't set up on this deployment yet."
              : s.lastDigestAt
                ? `Last summary sent ${timeAgo(s.lastDigestAt)}${s.lastDigestError ? ` · last error: ${s.lastDigestError}` : ""}`
                : "No summary sent yet."}
          </Card.Description>
        </Card.Header>
        <Card.Content><AppSettingsForm s={s} /></Card.Content>
      </Card>

      <form action={logout} className="animate-rise" style={{ animationDelay: "120ms" }}>
        <Button type="submit" variant="ghost">Sign out</Button>
      </form>
    </div>
  );
}
