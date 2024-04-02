import { v4 as uuidv4 } from 'uuid';

import { ChatStoreConfig, PartialChat, Chat, Model, Message } from './types';
import { defaultChatStoreConfig } from './config';
import idb from './idb';

export class ChatStore {
  config: ChatStoreConfig = defaultChatStoreConfig;

  store: LocalForage;

  constructor() {
    // Initialize the configuration
    this.config = defaultChatStoreConfig;

    // Initialize the localforage store
    this.store = idb.createStore(this.config.storeName);
  }

  /**
   * Create a new chat
   */
  async createChat(
    title: string,
    username: string,
    model: Model
  ): Promise<string> {
    const id = uuidv4();
    const chat: Chat = {
      id,
      title,
      username,
      model,
      messages: [],
    };
    await idb.put<Chat>(chat.id, chat, this.store);
    return id;
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
   * Append a message to a chat
   */
  async appendMessage(chatId: string, message: Message): Promise<void> {
    const chat = await this.readChat(chatId);
    if (chat) {
      chat.messages.push(message);
      await idb.put<Chat>(chatId, chat, this.store);
    }
  }
}
