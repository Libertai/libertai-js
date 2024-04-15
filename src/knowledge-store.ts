import { distance } from 'ml-distance';

import {
  Document,
  Embedding,
  SearchResult,
  KnowledgeStoreConfig,
} from './types.js';
import { defaultKnowledgeStoreConfig } from './config.js';
import idb from './idb.js';
import { chunkText, embed, createDocument, createEmbedding } from './utils.js';

export class KnowledgeStore {
  config: KnowledgeStoreConfig;

  documents: Map<string, Document>;
  store: LocalForage;

  /**
   * @constructor
   * @param config The configuration for the knowledge store. If not provided, the default configuration will be used
   * @param config.storeName The name of the localforage store
   * @param config.embeddingApiUrl The URL of the embedding API
   * @param config.documentsKey The key to use for storing documents in localforage
   */
  constructor(config?: Partial<KnowledgeStoreConfig>) {
    // Initialize the configuration
    this.config = { ...defaultKnowledgeStoreConfig, ...config };

    // Initialize an Array to keep track of our documents
    this.documents = new Map<string, Document>();

    // Initialize the localforage store
    this.store = idb.createStore(this.config.storeName);

    this.load = this.load.bind(this);
    this.addDocument = this.addDocument.bind(this);
    this.removeDocument = this.removeDocument.bind(this);
    this.searchDocuments = this.searchDocuments.bind(this);
  }

  /**
   * Load the documents from localforage
   * @returns A map of document IDs to documents and stores it in the documents field
   * */
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

  /**
   * Add a document to the store
   * @param title The title of the document
   * @param content The content of the document
   * @param tags The tags to associate with the document
   * @returns The document that was added
   */
  async addDocument(
    title: string,
    content: string,
    tags = []
  ): Promise<Document> {
    // Create a new document object
    const doc = createDocument(title, tags);
    // Split the document into chunks (which are just Lanhchain documents)
    const chunks = await chunkText(title, content);

    // Embed each chunk and save the embeddings to localforage
    const batch_size = 10;
    let batch = [];
    try {
      for (const chunk of chunks) {
        batch.push(chunk);
        if (batch.length === batch_size) {
          await Promise.all(batch.map((c) => this.embedChunk(doc.id, c)));
          batch = [];
        }
      }
    } catch (e) {
      console.error(
        'libertai-js::KnowledgeStore::addDocument - Error embedding chunk: %s',
        e
      );
      await this.prune();
      throw Error('Error embedding batch: ' + e);
    }

    // Embed the last batch
    if (batch.length > 0) {
      await Promise.all(batch.map((c) => this.embedChunk(doc.id, c)));
    }

    // Add the document to our list of documents
    this.documents.set(doc.id, doc);
    await this.save();
    return doc;
  }

  /**
   * Remove a document from the store
   * @param documentIdd The ID of the document to remove
   * @returns The document that was removed
   * @throws An error if the document is not found
   */
  async removeDocument(documentId: string): Promise<Document> {
    const doc = this.documents.get(documentId);
    if (!doc) {
      throw new Error(`Document not found: documentId = ${documentId}`);
    }
    // Remove all embeddings for the document
    await this.store.iterate((obj, id, _iterationNumber) => {
      if (id === this.config.documentsKey) return;
      const embedding = obj as Embedding;
      if (embedding.documentId === documentId) {
        this.store.removeItem(id);
      }
    });

    // Remove
    this.documents.delete(documentId);
    await this.save();
    return doc;
  }

  /**
   * Prune the store by removing embeddings that are not associated with a document
   * @returns The number of embeddings that were removed
   */
  async prune(): Promise<number> {
    let count = 0;
    await this.store.iterate((obj, id, _iterationNumber) => {
      if (id === this.config.documentsKey) return;
      const embedding = obj as Embedding;
      if (!this.documents.has(embedding.documentId)) {
        this.store.removeItem(id);
        count += 1;
      }
    });
    return count;
  }

  /**
   * Search the documents in the store for the given query for similarity by euclidean distance
   * @param query The query to search for
   * @param callback A callback to be called with each result
   * @param k The number of results to return
   * @param max_distance The maximum distance between the query and a result
   * @param tags The tags to filter by. If empty, no filtering is done
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
        console.warn(
          "libertai-js::KnowledgeStore::searchDocuments - Couldn't find document for embedding: embdding_id = %s",
          embedding.id
        );
        return;
      }

      // Filter by tags (if any are provided)
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

  private async save(): Promise<void> {
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
