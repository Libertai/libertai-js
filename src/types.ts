/* Knowledge types */

// For now, just don't worry about the content of the document
//  That will be chunked across multiple embeddings
export interface Document {
  id: string;
  title: string;
}

export interface Embedding {
  id: string;
  documentId: string;
  content: string;
  vector: number[];
}

export interface PartialEmbeddingWithDistance {
  content: string;
  vector: number[];
  distance: number;
}

export interface SearchResult {
  query: string;
  vector: number[];
  matches: PartialEmbeddingWithDistance[];
}

/* Chat Interface types */

// TODO: this might be better placed at a higher level, but for now it's here
export interface Chat {
  // Chat id
  id: string;
  // Chat name
  title: string;
  // Chat particpant's User Name
  username: string;
  // The model in use for the chat
  model: Model;
  // Ordered list of chat messages
  messages: Message[];
}

export interface Message {
  // Ordered message id
  id: number;
  // Date and time the message was sent
  timestamp: Date;
  // The user sending the message
  role: string;
  // Message content
  content: string;
}

export interface PartialChat {
  id: string;
  title: string;
}

/* Inference types */

// Basic ChatMl format
export interface ChatMl {
  // Prefix to user input or model output
  userPrepend: string;
  // Suffix to user input or model output
  userAppend: string;
  // Character to separate messages
  lineSeparator: string;

  // Default stop sequence for the model. This will be used to
  //  generate prompts for the model
  stopSequence: string;
  // Some models may require additional stop sequences, but we'll separate those
  additionalStopSequences: string[];
}

export interface Persona {
  // Persona name
  name: string;

  // Persona description
  description: string;

  // TODO: optioanlly set context embeddings
  // TODO: configure functions
}

// Common model definition across different engine types
// Defines resource, paramterization, persona, and prompt formatting
// for the model
export interface Model {
  /* Resource definition */

  // Model Api endpoint
  apiUrl: string;

  /* Inferencing parameters */

  // Maximum number of tokens to include in a prompt
  maxTokens: number;
  // Maximum number of tokens to generate
  maxPredict: number;
  // Max number of tries to generate a response
  maxTries: number;
  // Max number of tokens to generate
  temperature: number;
  topP: number;
  topK: number;
  minP: number;

  /* Prompt formatting */
  chatMl: ChatMl;
  persona: Persona;
}

/* Store Configuration types */

export type KnowledgeStoreConfig = {
  // Embedding API endpoint to use
  embeddingApiUrl: string;
  // Name of the local store to use
  storeName: string;
  // Special key that identifies docuements metadata in the store
  documentsKey: string;
};

export type ChatStoreConfig = {
  // Name of the local store to use
  storeName: string;
};
