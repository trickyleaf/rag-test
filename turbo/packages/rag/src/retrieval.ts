import type { RoleAccessPolicy } from "./acl";

export type RetrievedReference = {
  documentId: string;
  chunkId: string;
  title: string;
  quote: string;
  score: number;
  pageNumber?: number;
};

export type RetrieveContextInput = {
  query: string;
  policy: RoleAccessPolicy;
  limit?: number;
};

export type RetrieveContextResult = {
  context: string;
  references: RetrievedReference[];
};

export type Retriever = {
  retrieve(input: RetrieveContextInput): Promise<RetrieveContextResult>;
};
