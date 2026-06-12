"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { Sidebar } from "@/components/app-shell/sidebar";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/types";
import type { AppRole, AppUser } from "@/lib/types";

type AppShellProps = {
  children: React.ReactNode;
  dictionary: Dictionary;
  currentUser: AppUser;
  currentRole: AppRole;
  users: AppUser[];
};

export function AppShell({
  children,
  dictionary,
  currentUser,
  currentRole,
  users,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-full bg-background text-foreground">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        currentRole={currentRole}
        currentUser={currentUser}
        dictionary={dictionary}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        users={users}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b px-4 py-3 md:hidden">
          <Button onClick={() => setSidebarOpen(true)} size="icon" variant="ghost">
            <Menu className="size-5" />
          </Button>
          <span className="font-semibold">{dictionary.app.title}</span>
        </div>
        {children}
      </main>
    </div>
  );
}
