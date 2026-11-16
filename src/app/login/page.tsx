import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Brand Pulse" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Brand <span className="text-gradient">Pulse</span>
        </h1>
        <p className="text-sm text-muted">Reddit brand monitoring. Enter the team password to continue.</p>
      </div>
      <LoginForm next={next ?? "/"} />
    </main>
  );
}
