import {
  DEFAULT_EMBEDDING_API_URL,
  DEFAULT_KNOWLEDGE_STORE_DOCUMENTS_KEY,
  DEFAULT_KNOWLEDGE_STORE_NAME,
} from './constants.js';
import { KnowledgeStoreConfig } from './types.js';

export const defaultKnowledgeStoreConfig = {
  embeddingApiUrl: DEFAULT_EMBEDDING_API_URL,

  storeName: DEFAULT_KNOWLEDGE_STORE_NAME,
  documentsKey: DEFAULT_KNOWLEDGE_STORE_DOCUMENTS_KEY,
} as KnowledgeStoreConfig;

export default {
  defaultKnowledgeStoreConfig,
};
