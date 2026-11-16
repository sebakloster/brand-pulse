import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/login/actions";
import { NavLinks } from "@/components/nav-links";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/queue" className="text-lg font-semibold tracking-tight">
            Brand <span className="text-gradient">Pulse</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <Suspense><NavLinks variant="top" /></Suspense>
          </nav>
          <form action={logout}>
            <button className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:pb-10">{children}</main>
      {/* Mobile: bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-background/95 backdrop-blur sm:hidden">
        <Suspense><NavLinks variant="bottom" /></Suspense>
      </nav>
    </div>
  );
}
