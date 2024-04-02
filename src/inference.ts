import { Model, Message } from './types';
import { calculateTokenLength } from './utils';

// Simple wrapper class around basic AI inference utilities
export class LlamaCppApiEngine {
  // Map of endpoints to active slot ids
  slots: Map<string, number> = new Map();

  constructor() {
    this.slots = new Map();
  }
  // Generate an anser to a sequence of messages
  // using the provided model
  async *generateAnswer(
    messages: Message[],
    model: Model
  ): AsyncGenerator<{ content: string; stopped: boolean }> {
    const maxTries = model.maxTries;
    // Prepare the prompt
    const prompt = this.preparePrompt(messages, model);

    let compoundedResult = '';
    let stopped = false;
    let tries = 0;
    while (!stopped && tries < maxTries) {
      tries += 1;
      const [lastResult, stop] = await this.complete(
        prompt + compoundedResult,
        model
      );
      compoundedResult = compoundedResult + lastResult;
      if (lastResult.length == 1 || stop) {
        stopped = true;
      }
      yield { content: compoundedResult, stopped };
    }
  }

  /* Utils */

  /* Generate the next completion of a prompt */
  async complete(prompt: string, model: Model): Promise<[string, boolean]> {
    const chatMl = model.chatMl;
    const slotId = this.slots.get(model.apiUrl) || -1;
    const params = {
      // Define the prompt
      prompt: prompt,
      stream: true,

      // Set inference parameters
      temperature: model.temperature,
      n_predict: model.maxPredict,
      top_p: model.topP,
      top_k: model.topK,
      min_p: model.minP,
      typical_p: 1,
      tfs_z: 1,

      // Setup caching
      // Use both id_slot and slot_id to handle multiple version of the API
      id_slot: slotId,
      slot_id: slotId,
      cache_prompt: true,

      // Set the stop sequence
      stop: [chatMl.stopSequence, ...chatMl.additionalStopSequences],
    };

    // Make the request
    const response = await fetch(model.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    // Parse the response as JSON
    const data = await response.json();

    // Parse the response
    const slot_id = data.id_slot || data.slot_id;
    this.slots.set(model.apiUrl, slot_id);
    const stop = data.stop || false;
    const content = data.content || '';
    return [content, stop];
  }

  private preparePrompt(messages: Message[], model: Model): string {
    let usedTokens = 0;
    const maxTokens = model.maxTokens;
    const chatMl = model.chatMl;
    const persona = model.persona;

    // Prepare our system prompt
    let systemPrompt = '';
    systemPrompt += `${chatMl.userPrepend}SYSTEM${chatMl.lineSeparator}`;
    systemPrompt += `You are ${persona.name}${chatMl.lineSeparator}`;
    systemPrompt += `${persona.description}${chatMl.lineSeparator}`;
    systemPrompt += `${chatMl.stopSequence}`;

    // Determine how many tokens we have left
    usedTokens = calculateTokenLength(systemPrompt);

    // Iterate over messagse in reverse order
    // to generate the chat log
    let chatLog = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      let messageLog = '';
      messageLog += `${chatMl.userPrepend}${message.role}${chatMl.lineSeparator}`;
      messageLog += `${message.content}${chatMl.lineSeparator}`;
      messageLog += `${chatMl.stopSequence}${chatMl.lineSeparator}`;

      const messageTokens = calculateTokenLength(messageLog);
      if (usedTokens + messageTokens <= maxTokens) {
        chatLog = `${messageLog}${chatLog}`;
        usedTokens += messageTokens;
      } else {
        break;
      }
    }

    // Generate the prompt
    const prompt = `${systemPrompt}${chatLog}`;
    return prompt;
  }
}
