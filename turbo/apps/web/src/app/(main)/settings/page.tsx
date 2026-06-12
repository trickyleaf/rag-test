import { redirect } from "next/navigation";

import { SettingsPanel } from "@/components/settings/settings-panel";
import { getDictionary } from "@/i18n/locale";
import { getCurrentUser } from "@/lib/auth";
import { getAllRoles, getAllTags, getAllUsers } from "@/lib/queries";

export default async function SettingsPage() {
  const [dictionary, { role }] = await Promise.all([getDictionary(), getCurrentUser()]);

  if (!role.policy.isAdmin) {
    redirect("/");
  }

  const [roles, tags, users] = await Promise.all([getAllRoles(), getAllTags(), getAllUsers()]);

  return (
    <SettingsPanel dictionary={dictionary} roles={roles} tags={tags} users={users} />
  );
}
