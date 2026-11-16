"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { ReplyComposer } from "./reply-composer";

type Props = React.ComponentProps<typeof ReplyComposer> & { recommended: boolean; why: string };

/** Shows the composer when a reply is recommended; otherwise says why not, with a way to reply anyway. */
export function ReplySection({ recommended, why, ...composer }: Props) {
  const [open, setOpen] = useState(recommended || !!composer.draft);
  if (!open) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted">{why}</p>
        <Button variant="ghost" size="sm" onPress={() => setOpen(true)}>Write a reply anyway</Button>
      </div>
    );
  }
  return <ReplyComposer {...composer} />;
}
