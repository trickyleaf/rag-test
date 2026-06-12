import type { RoleAccessPolicy } from "./acl";
import type { RetrievedReference } from "./retrieval";

export type StoredDocument = {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  sourceLabel?: string;
};

export type LlamaIndexNode = {
  id: string;
  content: string;
  metadata: {
    documentId: string;
    pageNumber?: number;
    sourceLabel?: string;
    parser: "llamaparse-cloud" | "llamaparse-onprem" | "llamaindex-onprem";
  };
};

export type DocumentStorage = {
  getDocument(storageKey: string): Promise<StoredDocument>;
  putDocument(input: StoredDocument): Promise<{ storageKey: string }>;
};

export type DocumentParser = {
  parse(input: StoredDocument & { documentId: string }): Promise<LlamaIndexNode[]>;
};

export type EmbeddingProvider = {
  embedTexts(texts: readonly string[]): Promise<readonly number[][]>;
};

export type VectorStore = {
  upsertNodes(input: {
    documentId: string;
    tagKeys: readonly string[];
    nodes: readonly LlamaIndexNode[];
    embeddings: readonly number[][];
  }): Promise<void>;
};

export type ChatModel = {
  streamAnswer(input: {
    messages: readonly unknown[];
    context: string;
    references: readonly RetrievedReference[];
    userId: string;
  }): unknown;
};

export type ContextRetriever = {
  retrieve(input: {
    query: string;
    policy: RoleAccessPolicy;
    limit?: number;
  }): Promise<{
    context: string;
    references: RetrievedReference[];
  }>;
};
