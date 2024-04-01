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

export interface PartialEmbeddingWithDistance {
  content: string;
  vector: number[];
  distance: number;
}

export interface SearchResult {
  query: string;
  vector: number[];
  matches: PartialEmbeddingWithDistance[];
}

export type Config = {
  embeddingApiUrl: string;

  knowledgeDbStoreName: string;
  knowledgeDbDocumentsKey: string;
};
