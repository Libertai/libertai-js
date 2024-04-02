import { distance } from 'ml-distance';

import {
  Document,
  Embedding,
  SearchResult,
  KnowledgeStoreConfig,
  PartialEmbeddingWithDistance,
} from './types';
import { defaultKnowledgeStoreConfig } from './config';
import idb from './idb';
import { chunkText, embed, createDocument, createEmbedding } from './utils';

export class KnowledgeStore {
  config: KnowledgeStoreConfig = defaultKnowledgeStoreConfig;

  documents: Document[];
  store: LocalForage;

  constructor() {
    // Initialize the configuration
    this.config = defaultKnowledgeStoreConfig;

    // Initialize an Array to keep track of our documents
    this.documents = [];

    // Initialize the localforage store
    this.store = idb.createStore(this.config.storeName);

    this.load = this.load.bind(this);
    this.addDocument = this.addDocument.bind(this);
    this.searchDocuments = this.searchDocuments.bind(this);
    this.save = this.save.bind(this);
  }

  async load(): Promise<Document[]> {
    // Load the documents from localforage
    const item = await idb.get<Document[]>(
      this.config.documentsKey,
      this.store
    );
    if (item) {
      this.documents = item;
    } else {
      this.documents = [];
    }

    return this.documents;
  }

  async addDocument(
    this: KnowledgeStore,
    title: string,
    content: string
  ): Promise<Document> {
    console.log('KnowledgeDB::addDocument');

    // Create a new document object
    const document = createDocument(title);

    // Split the document into chunks (which are just Lanhchain documents)
    const chunks = await chunkText(title, content);

    // TODO: There's probably a better way to background
    //  these embeddings, but for now we'll just do it in series
    const promises = [];
    for (const chunk of chunks) {
      promises.push(this.embedChunk(document.id, chunk));
    }
    await Promise.all(promises);
    console.log('KnowledgeDB::addDocument - Embeddings Added');

    // Add the document to our list of documents
    this.documents.push(document);
    await this.save();
    console.log('KnowledgeDB::addDocument - Document Saved');

    return document;
  }

  async searchDocuments(
    query: string,
    k = 5,
    max_distance = 15
  ): Promise<SearchResult> {
    console.log('KnowledgeDB::searchDocuments');
    const query_vector = await embed(query, this.config.embeddingApiUrl);
    const res = {
      query,
      vector: query_vector,
      matches: [] as PartialEmbeddingWithDistance[],
    } as SearchResult;
    let farthest = Number.MAX_VALUE;
    let farthest_index = -1;
    // Iterate over all embeddings
    this.store.iterate((obj, id, _iterationNumber) => {
      // Skip the documents key
      if (id === this.config.documentsKey) return;
      // Check if this is a valid embedding
      const embedding = obj as Embedding;

      // Get the euclidean distance between the query and the embedding
      const euclidean_distance = distance.euclidean(
        query_vector,
        embedding.vector
      );

      // If the distance is greater than the max_distance, skip it
      if (euclidean_distance > max_distance) return;

      // If we have less than k matches, add this one
      if (res.matches.length < k) {
        res.matches.push({
          content: embedding.content,
          vector: embedding.vector,
          distance: euclidean_distance,
        });
        // Make sure we keep track of the farthest match, if it is indeed the farthest
        if (euclidean_distance > farthest) {
          farthest = euclidean_distance;
          farthest_index = res.matches.length - 1;
        }
      }
      // Otherwise, decide if we should replace the farthest match
      else if (euclidean_distance < farthest) {
        // Replace the farthest match
        res.matches[farthest_index] = {
          content: embedding.content,
          vector: embedding.vector,
          distance: euclidean_distance,
        };
        // Naively find the new farthest match
        farthest = Number.MIN_VALUE;
        for (let i = 0; i < res.matches.length; i++) {
          if (res.matches[i].distance > farthest) {
            farthest = res.matches[i].distance;
            farthest_index = i;
          }
        }
      }
    });
    return res;
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
