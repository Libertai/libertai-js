/* Chat Interface types */

export interface Message {
  // The name of the user sending the message
  role: string;
  // Message content
  content: string;
  thought?: string;
}

/* Inference types */

// Basic PromptFormat format
export interface PromptFormat {
  // Prefix to user input or model output
  userPrepend: string;
  // Suffix to user input or model output
  userAppend: string;
  // Character to separate messages
  lineSeparator: string;
  // Token to denote the start of any additional logs
  logStart: string;
  // Default stop sequence for the model. This will be used to
  //  generate prompts for the model
  stopSequence: string;
  // Some models may require additional stop sequences, but we'll separate those
  additionalStopSequences: string[];
}

// TODO: Tighter compliance with tavern-ai persona formatting OR a more opinionated
// and extensible persona format of our own
//  https://github.com/TavernAI/TavernAI/tree/main
export interface Persona {
  // Persona role
  role: string;

  // Persona description
  description: string;
}

// Common model definition across different engine types
// Defines resource, parameterization, persona, and prompt formatting
// for the model
export interface Model {
  /* Resource definition */

  // Model Name
  name: string;
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
  promptFormat: PromptFormat;

  withCredentials: boolean;
}
