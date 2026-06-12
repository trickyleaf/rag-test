import type {
  DocumentParser,
  DocumentStorage,
  EmbeddingProvider,
  VectorStore,
} from "./providers";

export type IngestionStatus = "uploaded" | "processing" | "ready" | "failed";

export type IngestDocumentInput = {
  documentId: string;
  storageKey: string;
  tagKeys: readonly string[];
};

export type IngestionDependencies = {
  storage: DocumentStorage;
  parser: DocumentParser;
  embeddings: EmbeddingProvider;
  vectorStore: VectorStore;
};

export async function ingestDocument(
  input: IngestDocumentInput,
  dependencies: IngestionDependencies,
) {
  const storedDocument = await dependencies.storage.getDocument(input.storageKey);
  const nodes = await dependencies.parser.parse({
    ...storedDocument,
    documentId: input.documentId,
  });
  const embeddings = await dependencies.embeddings.embedTexts(
    nodes.map((node) => node.content),
  );

  await dependencies.vectorStore.upsertNodes({
    documentId: input.documentId,
    tagKeys: input.tagKeys,
    nodes,
    embeddings,
  });

  return {
    documentId: input.documentId,
    nodeCount: nodes.length,
  };
}
