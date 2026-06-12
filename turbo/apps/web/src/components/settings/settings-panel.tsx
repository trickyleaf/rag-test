import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Dictionary } from "@/i18n/types";
import type { AppRole, AppTag, AppUser } from "@/lib/types";

type SettingsPanelProps = {
  dictionary: Dictionary;
  roles: AppRole[];
  tags: AppTag[];
  users: AppUser[];
};

export function SettingsPanel({ dictionary, roles, tags, users }: SettingsPanelProps) {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto space-y-4 border-t p-4 sm:p-8" id="settings">
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-5" />
        <div>
          <h2 className="text-xl font-semibold">{dictionary.settings.title}</h2>
          <p className="text-sm text-muted-foreground">{dictionary.settings.description}</p>
        </div>
      </div>

      <Tabs defaultValue="tags">
        <TabsList>
          <TabsTrigger value="tags">{dictionary.settings.tags}</TabsTrigger>
          <TabsTrigger value="roles">{dictionary.settings.roles}</TabsTrigger>
          <TabsTrigger value="users">{dictionary.settings.users}</TabsTrigger>
        </TabsList>

        <TabsContent className="grid gap-3 md:grid-cols-2" value="tags">
          {tags.map((tag) => (
            <Card key={tag.key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{tag.label}</CardTitle>
                  {tag.isSystem ? <Badge>system</Badge> : null}
                </div>
                <CardDescription>{tag.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </TabsContent>

        <TabsContent className="grid gap-3" value="roles">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <CardTitle>{role.name}</CardTitle>
                <CardDescription>
                  {role.policy.isAdmin ? "Admin bypass" : "Tag ACL policy"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2">
                <PolicyList label="Allowed" values={role.policy.allowedTagKeys} />
                <PolicyList label="Denied" values={role.policy.deniedTagKeys} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent className="grid gap-3 md:grid-cols-2" value="users">
          {users.map((user) => (
            <Card key={user.id}>
              <CardHeader>
                <CardTitle>{user.name}</CardTitle>
                <CardDescription>{user.email}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary">{user.roleName}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function PolicyList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((value) => (
            <Badge key={value} variant="outline">
              {value}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">none</span>
        )}
      </div>
    </div>
  );
}
