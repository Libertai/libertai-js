import { v4 as uuidv4 } from 'uuid';

import {
  ChatsStoreConfig,
  PartialChat,
  Chat,
  Model,
  Message,
  Persona,
} from './types';
import { defaultChatsStoreConfig } from './config';
import idb from './idb';

export class ChatsStore {
  config: ChatsStoreConfig = defaultChatsStoreConfig;

  store: LocalForage;

  constructor() {
    // Initialize the configuration
    this.config = defaultChatsStoreConfig;

    // Initialize the localforage store
    this.store = idb.createStore(this.config.storeName);
  }

  /**
   * Create a new chat
   */
  async createChat(
    title: string,
    username: string,
    model: Model,
    persona: Persona
  ): Promise<PartialChat> {
    const id = uuidv4();
    const chat: Chat = {
      id,
      title,
      username,
      model,
      persona,
      messages: [],
    };
    return (await idb.put<Chat>(chat.id, chat, this.store)) as PartialChat;
  }

  /**
   * Read all chats from the store as partials
   */
  async readChats(): Promise<PartialChat[]> {
    // Naively iterate over all keys and return the necessary data
    // Should scale well enough for now
    const result = [] as PartialChat[];
    await this.store.iterate((value, _key) => {
      const partialChat = value as PartialChat;
      result.push(partialChat);
    });
    return result;
  }

  /**
   * Read a chat from the store by its id
   */
  async readChat(id: string): Promise<Chat | null> {
    return idb.get<Chat>(id, this.store);
  }

  /**
   * Update a chat's model
   */
  async updateChatModel(chatId: string, model: Model): Promise<void> {
    const chat = await this.readChat(chatId);
    if (chat) {
      chat.model = model;
      await idb.put<Chat>(chatId, chat, this.store);
    }
  }

  /**
   * Update a chat's title
   */
  async updateChatTitle(chatId: string, title: string): Promise<void> {
    const chat = await this.readChat(chatId);
    if (chat) {
      chat.title = title;
      await idb.put<Chat>(chatId, chat, this.store);
    }
  }

  /* pop the last message from the chat */
  async popChatMessages(chatId: string): Promise<void> {
    const chat = await this.readChat(chatId);
    if (chat) {
      chat.messages.pop();
      await idb.put<Chat>(chatId, chat, this.store);
    }
  }

  /**
   * Append a user message to a chat
   */
  async appendUserMessage(
    chatId: string,
    messageContent: string
  ): Promise<Message> {
    const chat = await this.readChat(chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }
    const message = {
      id: 0,
      role: chat.username,
      content: messageContent,
      timestamp: new Date(),
    } as Message;
    const lastMessage = chat.messages[-1];
    if (lastMessage) {
      message.id = lastMessage.id + 1;
    }
    chat.messages.push(message);
    await idb.put<Chat>(chatId, chat, this.store);
    return message;
  }

  /**
   * Append a model's response to a chat
   */
  async appendModelResponse(
    chatId: string,
    responseContent: string
  ): Promise<Message> {
    const chat = await this.readChat(chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }
    const lastMessage = chat.messages[-1];
    const message: Message = {
      id: lastMessage.id + 1,
      role: chat.persona.name,
      content: responseContent,
      timestamp: new Date(),
    };
    chat.messages.push(message);
    await idb.put<Chat>(chatId, chat, this.store);
    return message;
  }

  /**
   * Delete a chat from the store
   */
  async deleteChat(id: string): Promise<void> {
    await idb.rm(id, this.store);
  }
}
