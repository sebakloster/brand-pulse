"use client";

import { useActionState } from "react";
import { Button, FieldError, Input, Label, TextField } from "@heroui/react";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <TextField name="password" type="password" isRequired autoFocus isInvalid={!!state?.error} className="w-full">
        <Label>Password</Label>
        <Input autoComplete="current-password" />
        <FieldError>{state?.error}</FieldError>
      </TextField>
      <Button type="submit" fullWidth isPending={pending}>Sign in</Button>
    </form>
  );
}
