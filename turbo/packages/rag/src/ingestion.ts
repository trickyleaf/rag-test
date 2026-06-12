export type IngestionStatus = "uploaded" | "processing" | "ready" | "failed";

export type IngestDocumentInput = {
  documentId: string;
};

export type ParsedDocumentChunk = {
  content: string;
  metadata: {
    pageNumber?: number;
    sourceLabel?: string;
  };
};

export type DocumentParser = {
  parse(input: { storageKey: string; mimeType: string }): Promise<ParsedDocumentChunk[]>;
};

export type VectorIndexer = {
  upsertDocumentChunks(input: {
    documentId: string;
    tagKeys: readonly string[];
    chunks: readonly ParsedDocumentChunk[];
  }): Promise<void>;
};
