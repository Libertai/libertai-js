import {
  DEFAULT_EMBEDDING_API_URL,
  DEFAULT_KNOWLEDGE_STORE_DOCUMENTS_KEY,
  DEFAULT_KNOWLEDGE_STORE_NAME,
  DEFAULT_CHATS_STORE_NAME,
} from './constants.js';
import { KnowledgeStoreConfig, ChatStoreConfig } from './types.js';

export const defaultKnowledgeStoreConfig = {
  embeddingApiUrl: DEFAULT_EMBEDDING_API_URL,

  storeName: DEFAULT_KNOWLEDGE_STORE_NAME,
  documentsKey: DEFAULT_KNOWLEDGE_STORE_DOCUMENTS_KEY,
} as KnowledgeStoreConfig;

export const defaultChatStoreConfig = {
  storeName: DEFAULT_CHATS_STORE_NAME,
} as ChatStoreConfig;

export default {
  defaultKnowledgeStoreConfig,
  defaultChatStoreConfig,
};
