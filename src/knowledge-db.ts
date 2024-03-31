import { distance } from 'ml-distance';

import { Document, Embedding, Config } from './types';
import { defaultConfig } from './config';
import idb from './idb';
import { chunkText, embed, createDocument, createEmbedding } from './utils';

export class KnowledgeDb {
  config: Config;

  documents: Document[];
  store: LocalForage;

  constructor() {
    // Initialize the configuration
    this.config = defaultConfig;

    // Initialize an Array to keep track of our documents
    this.documents = [];

    // Initialize the localforage store
    this.store = idb.createStore(this.config.knowledgeDbStoreName);
  }

  async load() {
    // Load the documents from localforage
    const item = await idb.get<Document[]>(
      this.config.knowledgeDbDocumentsKey,
      (obj: unknown) => obj as Document[],
      this.store
    );
    if (item) {
      this.documents = item;
    } else {
      this.documents = [];
    }

    return this.documents;
  }

  async addDocument(this: KnowledgeDb, title: string, content: string) {
    console.log('KnowledgeDB::addDocument');

    // Create a new document object
    const document = createDocument(title);

    // Split the document into chunks (which are just Lanhchain documents)
    const chunks = await chunkText(title, content);

    // TODO: There's probably a better way to background
    //  these embeddings, but for now we'll just do it in series
    const promises = [];
    for (const chunk of chunks) {
      promises.push(
        (async function () {
          // Generate a new embedding for each chunk
          //@ts-ignore
          const embedding = createEmbedding(
            document.id,
            chunk,
            //@ts-ignore
            await embed(chunk, this.config.embeddingApiUrl)
          );

          // Save the embedding to localforage
          //@ts-ignore
          await idb.put<Embedding>(embedding.id, embedding, this.store);

          return;
        })()
      );
    }
    await Promise.all(promises);
    console.log('KnowledgeDB::addDocument - Embeddings Added');

    // Add the document to our list of documents
    this.documents.push(document);
    await this.save();
    console.log('KnowledgeDB::addDocument - Document Saved');

    return document;
  }

  // TODO: min distance
  async searchDocuments(query: string, k = 5) {
    console.log('KnowledgeDB::searchDocuments');
    const query_vector = await embed(query, this.config.embeddingApiUrl);
    const res = {
      query,
      vector: query_vector,
      matches: [] as any[],
    };
    let farthest = Number.MAX_VALUE;
    let farthest_index = -1;
    // Iterate over all embeddings
    this.store.iterate((obj, id, _iterationNumber) => {
      // Skip the documents key
      if (id === this.config.knowledgeDbDocumentsKey) return;
      // Check if this is a valid embedding
      const embedding = obj as Embedding;

      // Get the euclidean distance between the query and the embedding
      const euclidean_distance = distance.euclidean(
        query_vector,
        embedding.vector
      );
      // If we have less than k matches, add this one
      if (res.matches.length < k) {
        res.matches.push({
          ...embedding,
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
          ...embedding,
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

  async save() {
    // Save the documents to localforage
    await idb.put(
      this.config.knowledgeDbDocumentsKey,
      this.documents,
      this.store
    );
  }
}

/* Utils */
