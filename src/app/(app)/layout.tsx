import Link from "next/link";
import { Gear } from "@gravity-ui/icons";
import { ActivityTray } from "@/components/activity-tray";

// Server actions here (e.g. "Check Reddit now") keep working after responding.
export const maxDuration = 300;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-separator bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
          <Link href="/" className="font-semibold tracking-tight">
            Brand <span className="text-gradient">Pulse</span>
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <Gear className="size-4" />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-8">{children}</main>
      <ActivityTray />
    </div>
  );
}
