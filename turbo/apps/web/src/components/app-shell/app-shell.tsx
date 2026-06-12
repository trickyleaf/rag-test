import { Sidebar } from "@/components/app-shell/sidebar";
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
  return (
    <div className="flex h-full bg-background text-foreground">
      <Sidebar
        currentRole={currentRole}
        currentUser={currentUser}
        dictionary={dictionary}
        users={users}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
