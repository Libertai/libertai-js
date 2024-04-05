import { distance } from 'ml-distance';

import {
  Document,
  Embedding,
  SearchResult,
  KnowledgeStoreConfig,
} from './types';
import { defaultKnowledgeStoreConfig } from './config';
import idb from './idb';
import { chunkText, embed, createDocument, createEmbedding } from './utils';

export class KnowledgeStore {
  config: KnowledgeStoreConfig = defaultKnowledgeStoreConfig;

  documents: Map<string, Document>;
  store: LocalForage;

  constructor() {
    // Initialize the configuration
    this.config = defaultKnowledgeStoreConfig;

    // Initialize an Array to keep track of our documents
    this.documents = new Map<string, Document>();

    // Initialize the localforage store
    this.store = idb.createStore(this.config.storeName);

    this.load = this.load.bind(this);
    this.addDocument = this.addDocument.bind(this);
    this.searchDocuments = this.searchDocuments.bind(this);
    this.save = this.save.bind(this);
  }

  async load(): Promise<Map<string, Document>> {
    // Load the documents from localforage
    const item = await idb.get<Map<string, Document>>(
      this.config.documentsKey,
      this.store
    );
    if (item) {
      this.documents = item;
    }

    return this.documents;
  }

  async addDocument(
    this: KnowledgeStore,
    title: string,
    content: string,
    tags = []
  ): Promise<Document> {
    // Create a new document object
    const doc = createDocument(title, tags);
    // Split the document into chunks (which are just Lanhchain documents)
    const chunks = await chunkText(title, content);
    // TODO: There's probably a better way to background
    //  these embeddings, but for now we'll just do it in series
    const promises = [];
    for (const chunk of chunks) {
      promises.push(this.embedChunk(doc.id, chunk));
    }
    await Promise.all(promises);
    // Add the document to our list of documents
    this.documents.set(doc.id, doc);
    await this.save();
    return doc;
  }

  /**
   * Search the documents in the store for the given query
   * @param query The query to search for
   * @param callback A callback to be called with each result
   * @param k The number of results to return
   * @param max_distance The maximum distance between the query and a result
   * @param tags The tags to filter by
   * @returns A list of the k closest matches
   */
  async searchDocuments(
    query: string,
    k = 5,
    max_distance = 15,
    tags = []
  ): Promise<SearchResult[]> {
    const query_vector = await embed(query, this.config.embeddingApiUrl);
    let matches: SearchResult[] | null = null;
    matches = [];
    let n = 0;
    // Iterate over all embeddings
    await this.store.iterate((obj, id, _iterationNumber) => {
      if (n >= k) {
        return;
      }

      // Skip the documents key
      if (id === this.config.documentsKey) return;
      // Check if this is a valid embedding
      const embedding = obj as Embedding;

      // If we have tags, make sure the embedding has one of them
      const doc = this.documents.get(embedding.documentId);
      if (!doc) {
        console.error(
          `Embedding ${embedding.id} has no corresponding document`
        );
        return;
      }

      // Filter by tags
      if (tags.length !== 0) {
        for (const tag of tags) {
          if (doc.tags.includes(tag)) {
            break;
          }
          return;
        }
      }

      // Get the euclidean distance between the query and the embedding
      const euclidean_distance = distance.euclidean(
        query_vector,
        embedding.vector
      );

      // If the distance is greater than the max_distance, skip it
      if (euclidean_distance > max_distance) return;

      console.log(
        `Found document ${doc.title} with distance ${euclidean_distance}`
      );
      matches.push({
        content: embedding.content,
        vector: embedding.vector,
        distance: euclidean_distance,
      });
      n += 1;
    });
    return matches;
  }

  /* State utils */

  async save(): Promise<void> {
    // Save the documents to localforage
    await idb.put(this.config.documentsKey, this.documents, this.store);
  }

  /* Private Arrow Functions */

  private embedChunk = async (
    document_id: string,
    chunk: string
  ): Promise<void> => {
    const apiUrl = this.config.embeddingApiUrl;
    // Generate a new embedding for each chunk
    const embedding = createEmbedding(
      document_id,
      chunk,
      await embed(chunk, apiUrl)
    );

    // Save the embedding to localforage
    await idb.put<Embedding>(embedding.id, embedding, this.store);

    return;
  };
}
