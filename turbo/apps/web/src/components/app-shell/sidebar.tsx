"use client";

import { Bot, FileText, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserPicker } from "@/components/auth/user-picker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Dictionary } from "@/i18n/types";
import type { AppRole, AppUser } from "@/lib/types";

type SidebarProps = {
  dictionary: Dictionary;
  currentUser: AppUser;
  currentRole: AppRole;
  users: AppUser[];
};

export function Sidebar({ dictionary, currentUser, currentRole, users }: SidebarProps) {
  const pathname = usePathname();

  const items = [
    { label: dictionary.nav.chat, icon: Bot, href: "/" },
    { label: dictionary.nav.documents, icon: FileText, href: "/documents" },
    { label: dictionary.nav.settings, icon: Settings, href: "/settings", adminOnly: true },
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
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                ].join(" ")}
                href={item.href}
                key={item.href}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
      </nav>

      <div className="mt-auto space-y-4">
        <UserPicker dictionary={dictionary} selectedUserId={currentUser.id} users={users} />

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
            <p className="truncate text-xs text-muted-foreground">{currentUser.email}</p>
          </div>
          <Badge variant={currentRole.policy.isAdmin ? "default" : "secondary"}>
            {currentRole.name}
          </Badge>
        </div>
      </div>
    </aside>
  );
}
