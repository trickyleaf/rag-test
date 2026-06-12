import { AppShell } from "@/components/app-shell/app-shell";
import { ChatPanel } from "@/components/chat/chat-panel";
import { DocumentPanel } from "@/components/documents/document-panel";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { getDictionary } from "@/i18n/locale";
import { getCurrentUser } from "@/lib/auth";
import {
  demoRoles,
  demoTags,
  demoUsers,
  getAccessibleDocuments,
} from "@/lib/demo-data";

export default async function Home() {
  const dictionary = await getDictionary();
  const { user, role } = await getCurrentUser();
  const documents = getAccessibleDocuments(user);

  return (
    <AppShell currentRole={role} currentUser={user} dictionary={dictionary}>
      <ChatPanel dictionary={dictionary} />
      <DocumentPanel dictionary={dictionary} documents={documents} />
      {role.policy.isAdmin ? (
        <SettingsPanel
          dictionary={dictionary}
          roles={demoRoles}
          tags={demoTags}
          users={demoUsers}
        />
      ) : null}
    </AppShell>
  );
}
