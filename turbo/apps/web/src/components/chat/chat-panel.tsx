"use client";

import { useChat } from "@ai-sdk/react";
import { isTextUIPart } from "ai";
import { SendHorizontal } from "lucide-react";
import { useRef, useState } from "react";

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

export function ChatPanel({ dictionary }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, error } = useChat();

  const isLoading = status === "streaming" || status === "submitted";

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const sources =
    lastAssistantMsg?.parts?.filter((p) => p.type === "source-url") ?? [];

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    if (!input.trim() || isLoading) return;
    void sendMessage({ text: input });
    setInput("");
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
            {messages.map((message) => {
              const text = message.parts
                ?.filter(isTextUIPart)
                .map((p) => p.text)
                .join("") ?? "";
              return (
                <MessageBubble key={message.id} role={message.role as "user" | "assistant"}>
                  {text}
                </MessageBubble>
              );
            })}
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
            onSubmit={(e) => { e.preventDefault(); submit(); }}
          >
            <Textarea
              className="min-h-14 resize-none"
              disabled={isLoading}
              onChange={(e) => setInput(e.target.value)}
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
              {sources.length > 0
                ? `${sources.length} source${sources.length > 1 ? "s" : ""} retrieved`
                : "References appear here after retrieval."}
            </CardDescription>
          </CardHeader>
          {sources.length > 0 && (
            <CardContent className="space-y-3">
              {sources.map((part, i) => {
                if (part.type !== "source-url") return null;
                return (
                  <div className="rounded-lg border p-3" key={part.sourceId ?? i}>
                    <p className="text-sm font-medium truncate">{part.title ?? part.sourceId}</p>
                  </div>
                );
              })}
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
