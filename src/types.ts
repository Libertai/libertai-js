// For now, just don't worry about the content of the document
//  That will be chunked across multiple embeddings
export interface Document {
  id: string;
  title: string;
}

export interface Embedding {
  id: string;
  documentId: string;
  content: string;
  vector: number[];
}

export type Config = {
  embeddingApiUrl: string;

  knowledgeDbStoreName: string;
  knowledgeDbDocumentsKey: string;
};

export interface KnowledgeDb {
  cfg: Config;

  /* State Management */

  load(): Promise<void>;
  save(): Promise<void>;
  clear(): Promise<void>;
}
