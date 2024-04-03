/*

import { KnowledgeStore } from './knowledge-store';
import { ChatStore } from './chat-store';
import { LlamaCppApiEngine } from './inference';
import { Chat, Model, Persona } from './types';

// High level agent class for coordinating the knowledge store, chat store, and inference engine to create a conversational agent
export class Agent {
  knowledgeStore: KnowledgeStore;
  chatStore: ChatStore;
  inferenceEngine: LlamaCppApiEngine;

  // The focused chat
  chat: Chat | null = null;
  constructor() {
    this.knowledgeStore = new KnowledgeStore();
    this.chatStore = new ChatStore();
    this.inferenceEngine = new LlamaCppApiEngine();
  }

  // Create a new chat with an initial message
  async createChat(
    username: string,
    model: Model,
    persona: Persona,
    firstMessage: string
  ): Promise<Chat> {
    // Summarize the first message in order to create a chat title
    const title = await this.inferenceEngine.summarizeSnippet(
      firstMessage,
      model
    );
    // Create a new chat in the local chat store
    const chat = await this.chatStore.createChat(
      title,
      username,
      model,
      persona
    );

    this.chat = chat;
    return chat;
  }

  async setChat(chatId: string): Promise<Chat> {
    this.chat = await this.chatStore.readChat(chatId);
    if (!this.chat) {
      throw new Error('Chat not found');
    }
    return this.chat;
  }
}
*/
