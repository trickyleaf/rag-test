import { AppShell } from "@/components/app-shell/app-shell";
import { getDictionary } from "@/i18n/locale";
import { getCurrentUser } from "@/lib/auth";
import { getAllUsers } from "@/lib/queries";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const [dictionary, { user, role }, users] = await Promise.all([
    getDictionary(),
    getCurrentUser(),
    getAllUsers(),
  ]);

  return (
    <AppShell currentRole={role} currentUser={user} dictionary={dictionary} users={users}>
      {children}
    </AppShell>
  );
}
