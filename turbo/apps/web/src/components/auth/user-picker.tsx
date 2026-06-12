"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/i18n/types";
import type { AppUser } from "@/lib/types";

type UserPickerProps = {
  dictionary: Dictionary;
  users: AppUser[];
  selectedUserId: string;
};

export function UserPicker({ dictionary, users, selectedUserId }: UserPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(userId: string) {
    startTransition(async () => {
      await fetch("/api/auth/select-user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {dictionary.auth.chooseUser}
      </p>
      <div className="flex gap-2">
        <Select defaultValue={selectedUserId} disabled={isPending} onValueChange={handleChange}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button disabled={isPending} size="sm" variant="outline">
          {isPending ? "..." : "OK"}
        </Button>
      </div>
    </div>
  );
}
