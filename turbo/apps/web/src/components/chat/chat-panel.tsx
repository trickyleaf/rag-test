"use client";

import { useChat } from "@ai-sdk/react";
import { isTextUIPart } from "ai";
import { FileDown, SendHorizontal } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/types";

type SourcePart = {
  type: "source-url";
  sourceId: string;
  url: string;
  title?: string;
};

type ChatPanelProps = {
  dictionary: Dictionary;
};

function cleanTitle(title: string | undefined, sourceId: string): string {
  return (title ?? sourceId).replace(/ — score: \d+\.\d+$/, "");
}

function deduplicateSources(parts: SourcePart[]): SourcePart[] {
  const seen = new Set<string>();
  return parts.filter((p) => {
    if (seen.has(p.sourceId)) return false;
    seen.add(p.sourceId);
    return true;
  });
}

export function ChatPanel({ dictionary }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, error } = useChat();

  const isLoading = status === "streaming" || status === "submitted";
  const lastMessage = messages[messages.length - 1];
  const lastAssistantText =
    lastMessage?.role === "assistant"
      ? (lastMessage.parts?.filter(isTextUIPart).map((p) => p.text).join("") ?? "")
      : "";
  // Show the "thinking" bubble until the assistant starts producing text.
  const showThinking = isLoading && lastAssistantText.length === 0;

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
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center border-b px-4 py-4 sm:px-8 sm:py-5">
        <div>
          <h2 className="text-xl font-semibold">{dictionary.chat.title}</h2>
          <p className="text-sm text-muted-foreground">{dictionary.chat.empty}</p>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1 px-4 py-6 sm:px-8">
        <div ref={scrollRef} className="mx-auto flex max-w-3xl flex-col gap-5">
          {messages.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {dictionary.chat.empty}
            </p>
          )}
          {messages.map((message) => {
            const text =
              message.parts
                ?.filter(isTextUIPart)
                .map((p) => p.text)
                .join("") ?? "";
            const sources = deduplicateSources(
              (message.parts?.filter((p) => p.type === "source-url") ?? []) as SourcePart[],
            );
            return (
              <MessageBubble
                key={message.id}
                role={message.role as "user" | "assistant"}
                sources={sources}
              >
                {text}
              </MessageBubble>
            );
          })}
          {showThinking && (
            <MessageBubble role="assistant" sources={[]}>
              <span
                aria-live="polite"
                className="flex items-center gap-2 text-muted-foreground"
              >
                <span className="flex gap-1" aria-hidden>
                  <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-current" />
                </span>
                {dictionary.chat.thinking}
              </span>
            </MessageBubble>
          )}
          {error && !isLoading && (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
            >
              {dictionary.chat.error}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t bg-background/95 p-4 sm:p-6">
        <form
          className="mx-auto flex max-w-3xl gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
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
            <span className="hidden sm:inline">{dictionary.chat.send}</span>
          </Button>
        </form>
      </div>
    </section>
  );
}

function MessageBubble({
  children,
  role,
  sources,
}: {
  children: React.ReactNode;
  role: "assistant" | "user";
  sources: SourcePart[];
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
        {sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sources.map((s) => (
              <a
                key={s.sourceId}
                href={`/api/documents/${s.sourceId}/download`}
                download
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <FileDown className="size-3" />
                {cleanTitle(s.title, s.sourceId)}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
