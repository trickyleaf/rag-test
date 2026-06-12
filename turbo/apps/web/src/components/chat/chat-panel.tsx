"use client";

import { useChat } from "@ai-sdk/react";
import { SendHorizontal } from "lucide-react";
import { useRef } from "react";

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

type Reference = {
  documentId: string;
  chunkId: string;
  title: string;
  quote: string;
  score: number;
  pageNumber?: number;
};

type ChatPanelProps = {
  dictionary: Dictionary;
};

export function ChatPanel({ dictionary }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, data } =
    useChat({ api: "/api/chat" });

  const references: Reference[] = (data ?? [])
    .slice()
    .reverse()
    .flatMap((d) => {
      const item = d as { references?: Reference[] };
      return item.references ?? [];
    })
    .slice(0, 8);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-h-0 flex-col">
        <header className="border-b px-8 py-5">
          <h2 className="text-xl font-semibold">{dictionary.chat.title}</h2>
          <p className="text-sm text-muted-foreground">{dictionary.chat.empty}</p>
        </header>

        <ScrollArea className="min-h-0 flex-1 px-8 py-6">
          <div ref={scrollRef} className="mx-auto flex max-w-3xl flex-col gap-5">
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-12">
                {dictionary.chat.empty}
              </p>
            )}
            {messages.map((message) => (
              <MessageBubble key={message.id} role={message.role as "user" | "assistant"}>
                {message.content}
              </MessageBubble>
            ))}
            {isLoading && (
              <MessageBubble role="assistant">
                <span className="animate-pulse">…</span>
              </MessageBubble>
            )}
            {error && (
              <p className="text-center text-sm text-destructive">
                {error.message ?? "Chat unavailable. Check AI_GATEWAY_API_KEY."}
              </p>
            )}
          </div>
        </ScrollArea>

        <div className="border-t bg-background/95 p-6">
          <form
            className="mx-auto flex max-w-3xl gap-3"
            onSubmit={handleSubmit}
          >
            <Textarea
              className="min-h-14 resize-none"
              disabled={isLoading}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={dictionary.chat.placeholder}
              value={input}
            />
            <Button className="h-14 px-5" disabled={isLoading || !input.trim()} type="submit">
              <SendHorizontal className="size-4" />
              {dictionary.chat.send}
            </Button>
          </form>
        </div>
      </div>

      <aside className="border-l bg-muted/20 p-4">
        <Card>
          <CardHeader>
            <CardTitle>{dictionary.chat.sources}</CardTitle>
            <CardDescription>
              {references.length > 0
                ? `${references.length} source${references.length > 1 ? "s" : ""} retrieved`
                : "References appear here after retrieval."}
            </CardDescription>
          </CardHeader>
          {references.length > 0 && (
            <CardContent className="space-y-3">
              {references.map((ref) => (
                <div className="rounded-lg border p-3" key={ref.chunkId}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{ref.title}</p>
                    {ref.pageNumber && (
                      <Badge variant="secondary">p.{ref.pageNumber}</Badge>
                    )}
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground line-clamp-3">
                    {`"${ref.quote}"`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    score: {ref.score.toFixed(3)}
                  </p>
                </div>
              ))}
            </CardContent>
          )}
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
