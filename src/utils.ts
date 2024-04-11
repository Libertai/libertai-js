import axios from 'axios';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { v4 as uuidv4 } from 'uuid';

import { Document, Embedding } from './types';

/* Inferencing utility functions */

// TODO: more sophisticated tokenization
export function calculateTokenLength(input: string): number {
  return input.length / 2.7;
}

/* Embedding utility functions */

/*
 * Split a single Text Document into mutliple Documents of a given size
 */
export async function chunkText(
  title: string,
  content: string,
  chunkSize = 500,
  overlapSize = 100
): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: chunkSize,
    chunkOverlap: overlapSize,
    separators: ['\n\n---\n\n', '\n\n', '\n', ' '],
  });

  // Split into a list of langchain documents
  const documents = await splitter.createDocuments(
    [content],
    // TODO: include metadata
    [],
    {
      chunkHeader: `DOCUMENT TITLE: ${title}\n\n---\n\n`,
      appendChunkOverlapHeader: true,
    }
  );
  return documents.map((d) => d.pageContent);
}

export async function embed(
  content: string,
  apiUrl: string,
  tries: number = 3
): Promise<number[]> {
  let backoff = 1000;
  // Actually do the completion, calling the engine API
  const params = {
    content: content,
  };

  let response = null;
  const errors = [];
  for (let i = 0; i < tries; i++) {
    try {
      response = await axios.post(apiUrl, params);
      break;
    } catch (error) {
      errors.push(error);
      console.error(`Error embedding text: ${error}`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      backoff *= 2;
    }
  }
  if (response === null) {
    throw Error('failed to generate embedding: ' + errors);
  }

  return response.data.embedding;
}

export function createDocument(title: string, tags: string[] = []): Document {
  return {
    id: uuidv4(),
    title,
    tags: tags.map((tag) => tag.toLowerCase()),
  };
}

export function createEmbedding(
  documentId: string,
  content: string,
  vector: number[]
): Embedding {
  return {
    id: uuidv4(),
    documentId: documentId,
    content: content,
    vector: vector,
  };
}

export default {
  chunkText,
  embed,
  createDocument,
  createEmbedding,
};
