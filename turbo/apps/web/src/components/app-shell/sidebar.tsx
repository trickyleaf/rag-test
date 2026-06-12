import { Bot, FileText, Settings } from "lucide-react";

import { UserPicker } from "@/components/auth/user-picker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Dictionary } from "@/i18n/types";
import type { DemoRole, DemoUser } from "@/lib/demo-data";
import { demoUsers } from "@/lib/demo-data";

type SidebarProps = {
  dictionary: Dictionary;
  currentUser: DemoUser;
  currentRole: DemoRole;
};

export function Sidebar({
  dictionary,
  currentUser,
  currentRole,
}: SidebarProps) {
  const items = [
    { label: dictionary.nav.chat, icon: Bot },
    { label: dictionary.nav.documents, icon: FileText },
    { label: dictionary.nav.settings, icon: Settings, adminOnly: true },
  ];

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-muted/30 p-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{dictionary.app.title}</h1>
        <p className="text-sm text-muted-foreground">{dictionary.app.subtitle}</p>
      </div>

      <Separator className="my-4" />

      <nav className="space-y-1">
        {items
          .filter((item) => !item.adminOnly || currentRole.policy.isAdmin)
          .map((item) => {
            const Icon = item.icon;

            return (
              <a
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                href={`#${item.label.toLowerCase()}`}
                key={item.label}
              >
                <Icon className="size-4" />
                {item.label}
              </a>
            );
          })}
      </nav>

      <div className="mt-auto space-y-4">
        <UserPicker
          dictionary={dictionary}
          selectedUserId={currentUser.id}
          users={demoUsers}
        />

        <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <Avatar>
            <AvatarFallback>
              {currentUser.name
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{currentUser.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {currentUser.email}
            </p>
          </div>
          <Badge variant={currentRole.policy.isAdmin ? "default" : "secondary"}>
            {currentRole.name}
          </Badge>
        </div>
      </div>
    </aside>
  );
}
