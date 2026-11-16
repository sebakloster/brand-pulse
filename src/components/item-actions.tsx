"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, toast } from "@heroui/react";
import { discardMention, markMention } from "@/app/actions";

/** Two plain choices for an open item; one to bring a closed item back. */
export function ItemActions({ id, brandId, open, primary }: { id: string; brandId: string; open: boolean; primary: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const back = () => router.push(`/b/${brandId}`);

  function act(fn: () => Promise<void>, message: string, leave = true) {
    start(async () => {
      try {
        await fn();
        toast.success(message);
        if (leave) back(); else router.refresh();
      } catch {
        toast.danger("Couldn't save that. Please try again.");
      }
    });
  }

  if (!open) {
    return (
      <Button variant="secondary" isPending={pending} onPress={() => act(() => markMention(id, "open"), "Moved back to To do", false)}>
        Move back to To do
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={primary ? "primary" : "secondary"} isPending={pending} onPress={() => act(() => markMention(id, "handled"), "Marked as done")}>
        Done
      </Button>
      <Button variant="ghost" isDisabled={pending} onPress={() => act(() => discardMention(id, "not_about_brand"), "Dismissed as not relevant")}>
        Not relevant
      </Button>
    </div>
  );
}
