import { AppShell } from "@/components/app-shell/app-shell";
import { getDictionary, getLocale } from "@/i18n/locale";
import { getCurrentUser } from "@/lib/auth";
import { getAllUsers } from "@/lib/queries";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const [dictionary, locale, { user, role }, users] = await Promise.all([
    getDictionary(),
    getLocale(),
    getCurrentUser(),
    getAllUsers(),
  ]);

  return (
    <AppShell currentRole={role} currentUser={user} dictionary={dictionary} locale={locale} users={users}>
      {children}
    </AppShell>
  );
}
