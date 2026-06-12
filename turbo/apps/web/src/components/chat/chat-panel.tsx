import { SendHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/types";

type ChatPanelProps = {
  dictionary: Dictionary;
};

const demoReferences = [
  {
    title: "Company Handbook",
    quote: "Employees may use the handbook as the default policy reference.",
    tag: "any",
  },
  {
    title: "NDA Template",
    quote: "Confidentiality obligations survive contract termination.",
    tag: "legal",
  },
];

export function ChatPanel({ dictionary }: ChatPanelProps) {
  return (
    <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-h-0 flex-col">
        <header className="border-b px-8 py-5">
          <h2 className="text-xl font-semibold">{dictionary.chat.title}</h2>
          <p className="text-sm text-muted-foreground">{dictionary.chat.empty}</p>
        </header>

        <ScrollArea className="min-h-0 flex-1 px-8 py-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            <MessageBubble role="assistant">
              {
                "The RAG layer is ready to retrieve only from documents allowed by the selected user's tag policy."
              }
            </MessageBubble>
            <MessageBubble role="user">
              Which documents can this role use?
            </MessageBubble>
            <MessageBubble role="assistant">
              I will answer from accessible documents only and attach references
              for every claim once the vector store is connected.
            </MessageBubble>
          </div>
        </ScrollArea>

        <div className="border-t bg-background/95 p-6">
          <div className="mx-auto flex max-w-3xl gap-3">
            <Textarea
              className="min-h-14 resize-none"
              placeholder={dictionary.chat.placeholder}
            />
            <Button className="h-14 px-5">
              <SendHorizontal className="size-4" />
              {dictionary.chat.send}
            </Button>
          </div>
        </div>
      </div>

      <aside className="border-l bg-muted/20 p-4">
        <Card>
          <CardHeader>
            <CardTitle>{dictionary.chat.sources}</CardTitle>
            <CardDescription>References returned by retrieval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {demoReferences.map((reference) => (
              <div className="rounded-lg border p-3" key={reference.title}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{reference.title}</p>
                  <Badge variant="secondary">{reference.tag}</Badge>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {`"${reference.quote}"`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>
    </section>
  );
}

function MessageBubble({
  children,
  role,
}: {
  children: React.ReactNode;
  role: "assistant" | "user";
}) {
  return (
    <div className={role === "user" ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          role === "user"
            ? "max-w-[80%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground"
            : "max-w-[80%] rounded-2xl border bg-card px-4 py-3 text-sm"
        }
      >
        {children}
      </div>
    </div>
  );
}
