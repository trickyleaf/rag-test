"use client";

import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ConfirmDialogProps = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

export const ConfirmDialog = NiceModal.create<ConfirmDialogProps>(
  ({ title, description, confirmLabel = "Confirm", cancelLabel = "Cancel", variant = "default" }) => {
    const modal = useModal();

    function handleConfirm() {
      modal.resolve(true);
      modal.hide();
    }

    function handleCancel() {
      modal.resolve(false);
      modal.hide();
    }

    return (
      <Dialog open={modal.visible} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            {variant === "destructive" && (
              <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/10">
                <TriangleAlert className="size-5 text-destructive" />
              </div>
            )}
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleCancel}>
              {cancelLabel}
            </Button>
            <Button variant={variant} onClick={handleConfirm}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);
