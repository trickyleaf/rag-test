type IngestDocumentWorkflowInput = {
  documentId: string;
  storageKey: string;
  tagKeys: string[];
};

export async function ingestDocumentWorkflow(input: IngestDocumentWorkflowInput) {
  await markDocumentProcessing(input.documentId);
  const parsed = await parseDocument(input);
  const indexed = await indexDocument({
    ...input,
    nodeCount: parsed.nodeCount,
  });
  await markDocumentReady(input.documentId, indexed.nodeCount);

  return indexed;
}

async function markDocumentProcessing(documentId: string) {
  console.log(`Document ${documentId} processing`);
}

async function parseDocument(input: IngestDocumentWorkflowInput) {
  console.log(`Parsing ${input.documentId} from ${input.storageKey}`);

  return {
    documentId: input.documentId,
    nodeCount: 0,
  };
}

async function indexDocument(
  input: IngestDocumentWorkflowInput & { nodeCount: number },
) {
  console.log(
    `Indexing ${input.nodeCount} nodes for ${input.documentId} with tags ${input.tagKeys.join(",")}`,
  );

  return {
    documentId: input.documentId,
    nodeCount: input.nodeCount,
  };
}

async function markDocumentReady(documentId: string, nodeCount: number) {
  console.log(`Document ${documentId} ready with ${nodeCount} nodes`);
}
