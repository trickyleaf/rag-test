import type { Dictionary } from "../types";

export const en = {
  app: {
    title: "RAG Chat",
    subtitle: "Chat with governed documents using tag-based access control.",
  },
  nav: {
    chat: "Chat",
    documents: "Documents",
    settings: "Settings",
  },
  auth: {
    chooseUser: "Choose user",
    currentUser: "Current user",
  },
  chat: {
    title: "Ask your documents",
    empty: "Ask a question. Retrieval is filtered by the selected user's role.",
    placeholder: "Ask something about the accessible documents...",
    send: "Send",
    sources: "Sources",
    thinking: "Thinking…",
    error: "Something went wrong while answering. Please try again.",
  },
  documents: {
    title: "Documents",
    description: "Upload, tag, search and monitor ingestion status.",
    upload: "Upload document",
    search: "Search documents",
    status: "Status",
    tags: "Tags",
  },
  settings: {
    title: "Settings",
    description: "Admin area for tags, roles and mock users.",
    tags: "Tags",
    roles: "Roles",
    users: "Users",
  },
} satisfies Dictionary;
