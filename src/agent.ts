import { KnowledgeStore } from './knowledge-store';
import { ChatStore } from './chat-store';
import { LlamaCppApiEngine } from './inference';
import { Chat, Model } from './types';

// High level agent class for coordinating the knowledge store, chat store, and inference engine to create a conversational agent
export class Agent {
  knowledgeStore: KnowledgeStore;
  chatStore: ChatStore;
  inferenceEngine: LlamaCppApiEngine;

  // The focused chat
  chat: Chat | null = null;
  models: Model[];
  constructor(models: Model[]) {
    this.knowledgeStore = new KnowledgeStore();
    this.chatStore = new ChatStore();
    this.inferenceEngine = new LlamaCppApiEngine();

    this.models = models;
  }
}
