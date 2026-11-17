"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, toast } from "@heroui/react";
import { TrashBin } from "@gravity-ui/icons";
import { deleteBrand } from "@/app/brand-actions";

/** Removes the brand from the app and stops its checks and emails. */
export function DeleteBrand({ brandId, name }: { brandId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-md text-sm text-muted">
        Stops all checks and emails for this brand and removes it from your brands.
      </p>
      <Modal>
        <Button variant="danger-soft">
          <TrashBin className="size-4" /> Delete brand
        </Button>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-[400px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Delete {name}?</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  {name} will no longer be checked, and you won&apos;t get emails or alerts about it.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" slot="close">Cancel</Button>
                <Button
                  variant="danger"
                  isPending={pending}
                  onPress={() => start(async () => {
                    const r = await deleteBrand(brandId);
                    if (r.ok) {
                      toast.success(`${name} deleted`);
                      router.push("/");
                    } else {
                      toast.danger(r.message ?? "Couldn't delete the brand.");
                    }
                  })}
                >
                  Delete brand
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
