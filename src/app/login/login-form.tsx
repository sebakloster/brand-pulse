"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block space-y-2">
        <span className="text-sm text-muted">Password</span>
        <input
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          className="w-full rounded-full border border-border bg-surface px-5 py-3 outline-none focus:border-accent-from"
        />
      </label>
      {state?.error && <p className="text-sm text-p0">{state.error}</p>}
      <button
        disabled={pending}
        className="bg-gradient-accent w-full rounded-full px-5 py-3 font-medium text-black disabled:opacity-60"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
