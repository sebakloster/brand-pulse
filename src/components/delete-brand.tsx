"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Modal, TextField, toast } from "@heroui/react";
import { TrashBin } from "@gravity-ui/icons";
import { deleteBrand } from "@/app/brand-actions";

/** Permanent delete, behind a dialog where you type the brand's name. */
export function DeleteBrand({ brandId, name }: { brandId: string; name: string }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const matches = typed.trim() === name;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-md text-sm text-muted">
        Removes the brand and everything found for it. This can&apos;t be undone.
      </p>
      <Modal>
        <Button variant="danger-soft" onPress={() => setTyped("")}>
          <TrashBin className="size-4" /> Delete brand
        </Button>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-[400px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Delete {name}?</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4">
                <p className="text-sm text-muted">
                  All of {name}&apos;s mentions, replies, drafts and alerts will be permanently deleted.
                  What you&apos;ve already spent stays in your monthly total.
                </p>
                <TextField value={typed} onChange={setTyped} className="w-full">
                  <Label>Type <span className="font-semibold text-foreground">{name}</span> to confirm</Label>
                  <Input autoComplete="off" />
                </TextField>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" slot="close">Cancel</Button>
                <Button
                  variant="danger"
                  isDisabled={!matches}
                  isPending={pending}
                  onPress={() => start(async () => {
                    const r = await deleteBrand(brandId, typed);
                    if (r.ok) {
                      toast.success(`${name} deleted`);
                      router.push("/");
                    } else {
                      toast.danger(r.message ?? "Couldn't delete the brand.");
                    }
                  })}
                >
                  Delete permanently
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
