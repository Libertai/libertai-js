import {
  DEFAULT_EMBEDDING_API_URL,
  DEFAULT_DOCUMENTS_STORE_KEY,
  DEFAULT_KNOWLEDGE_DB_STORE_NAME,
} from './constants.js';
import { KnowledgeDbConfig } from './types.js';

export const defaultKnowledgeDbConfig: KnowledgeDbConfig = {
  embeddingApiUrl: DEFAULT_EMBEDDING_API_URL,

  knowledgeDbStoreName: DEFAULT_KNOWLEDGE_DB_STORE_NAME,
  knowledgeDbDocumentsKey: DEFAULT_DOCUMENTS_STORE_KEY,
} as KnowledgeDbConfig;

export default {
  defaultKnowledgeDbConfig,
};
