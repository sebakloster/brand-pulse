"use client";

import { useTransition } from "react";
import { Button, toast } from "@heroui/react";
import { ArrowsRotateRight } from "@gravity-ui/icons";
import { runNow } from "@/app/brand-actions";
import { ACTIVITY_EVENT } from "./activity-tray";

/** Starts a live Reddit check; progress shows in the floating tracker. */
export function CheckNowButton({ brandId, variant = "ghost", busy = false }: { brandId: string; variant?: "primary" | "ghost"; busy?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant={variant}
      isPending={pending}
      isDisabled={busy}
      onPress={() => start(async () => {
        const r = await runNow(brandId);
        if (r.ok) {
          toast(r.message, { description: "You can keep working. We'll let you know when it's done." });
          window.dispatchEvent(new Event(ACTIVITY_EVENT));
        } else {
          toast.danger(r.message);
        }
      })}
    >
      <ArrowsRotateRight className="size-4" />
      {busy ? "Checking…" : "Check Reddit now"}
    </Button>
  );
}
