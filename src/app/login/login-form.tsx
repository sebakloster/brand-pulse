"use client";

import { useActionState, useState } from "react";
import { Button, FieldError, Input, Label, TextField } from "@heroui/react";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  // isInvalid also sets the input's native validity, which makes the browser silently block the
  // next submit. So an error is dismissed once the user types again. (Empty values are ignored:
  // React's form reset after each submit fires onChange with "".)
  const [dismissed, setDismissed] = useState<typeof state>();
  const showError = !!state?.error && state !== dismissed && !pending;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <TextField
        name="password" type="password" isRequired autoFocus className="w-full"
        isInvalid={showError} onChange={(v) => { if (v) setDismissed(state); }}
      >
        <Label>Password</Label>
        <Input autoComplete="current-password" />
        <FieldError>{showError ? state?.error : null}</FieldError>
      </TextField>
      <Button type="submit" fullWidth isPending={pending}>Sign in</Button>
    </form>
  );
}
