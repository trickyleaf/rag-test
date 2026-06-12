import { Sidebar } from "@/components/app-shell/sidebar";
import type { Dictionary } from "@/i18n/types";
import type { DemoRole, DemoUser } from "@/lib/demo-data";

type AppShellProps = {
  children: React.ReactNode;
  dictionary: Dictionary;
  currentUser: DemoUser;
  currentRole: DemoRole;
};

export function AppShell({
  children,
  dictionary,
  currentUser,
  currentRole,
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <Sidebar
        currentRole={currentRole}
        currentUser={currentUser}
        dictionary={dictionary}
      />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
