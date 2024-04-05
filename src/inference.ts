import axios from 'axios';

import { Persona, Model, Message } from './types';
import { calculateTokenLength } from './utils';

// Simple wrapper class around basic AI inference utilities
export class LlamaCppApiEngine {
  // Map of endpoints to active slot ids
  slots: Map<string, number> = new Map();

  constructor() {
    this.slots = new Map();
  }

  clearSlots(): void {
    this.slots.clear();
  }

  // Generate an anser to a sequence of messages
  // using the provided model
  async *generateAnswer(
    messages: Message[],
    model: Model,
    persona: Persona,
    debug: boolean = false,
  ): AsyncGenerator<{ content: string; stopped: boolean }> {
    const maxTries = model.maxTries;
    const maxPredict = model.maxPredict;
    const stop_sequences = model.chatMl.additionalStopSequences.concat(
      model.chatMl.stopSequence
    );

    // Prepare the prompt
    const prompt = this.preparePrompt(messages, model, persona);

    if (debug) {
      console.log('libertai-js::LlamaCppApiEngine::generateAnswer::prompt', prompt);
    }

    let compoundedResult = '';
    let stopped = false;
    let tries = 0;
    while (!stopped && tries < maxTries) {
      tries += 1;
      // Ignore the stop, as for some reason it is not accurate for the time being
      const [lastResult, _stop] = await this.complete(
        prompt + compoundedResult,
        model
      );

      if (debug) {
        console.log('libertai-js::LlamaCppApiEngine::generateAnswer::lastResult', lastResult);
      }

      let fullResults = compoundedResult + lastResult;
      for (let i = 0; i < stop_sequences.length; i++) {
        fullResults = fullResults.split(`\n${stop_sequences[i]}`).join('|||||');
        fullResults = fullResults.split(`${stop_sequences[i]}`).join('|||||');
      }
      const results = fullResults.split('|||||');

      compoundedResult = results[0].trimEnd();

      let to_yield = compoundedResult;

      if (results.length > 1 || lastResult.length < maxPredict) {
        stopped = true;
      } else {
        stopped = false;
        if (tries < maxTries) {
          to_yield += ' *[writing ...]*';
        }
      }
      yield { content: to_yield, stopped };
    }
  }

  // Summarize a short snippet of text
  async summarizeSnippet(text: string, model: Model): Promise<string> {
    const examples = [
      {
        input: 'Hello, can you please write a short hello world code for me?',
        summary: 'Hello world',
      },
      {
        input:
          "What is the color of Henry IV's white horse?\nI'm not really sure",
        summary: "Henry IV's horse color",
      },
    ];
    const chatMl = model.chatMl;
    let prompt = '';
    prompt += `${chatMl.userPrepend}system${chatMl.lineSeparator}`;
    prompt += `You are summary function provided with input. Provide an at most 5 word summary of the first sentence of the provided input for the purpose of determining menu item names`;
    prompt += `${chatMl.lineSeparator}`;
    prompt += `${chatMl.stopSequence}${chatMl.lineSeparator}`;

    for (const example of examples) {
      prompt += `${chatMl.userPrepend}input${chatMl.lineSeparator}`;
      prompt += `${example.input}${chatMl.lineSeparator}`;
      prompt += `${chatMl.stopSequence}${chatMl.lineSeparator}`;
      prompt += `${chatMl.userPrepend}summary${chatMl.lineSeparator}`;
      prompt += `${example.summary}${chatMl.lineSeparator}`;
      prompt += `${chatMl.stopSequence}${chatMl.lineSeparator}`;
    }
    prompt += `${chatMl.userPrepend}input${chatMl.lineSeparator}`;
    prompt += `${text}${chatMl.lineSeparator}`;
    prompt += `${chatMl.stopSequence}${chatMl.lineSeparator}`;
    prompt += `${chatMl.userPrepend}summary${chatMl.lineSeparator}`;

    const [summary, _stop] = await this.complete(prompt, model);

    // Split the response into lines
    return summary.split(chatMl.lineSeparator)[0];
  }

  /* Utils */

  /* Generate the next completion of a prompt */
  async complete(prompt: string, model: Model): Promise<[string, boolean]> {
    const chatMl = model.chatMl;
    const slotId = this.slots.get(model.apiUrl) || -1;
    const params = {
      // Define the prompt
      prompt: prompt,
      stream: false,
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
    const response = await axios.post(model.apiUrl, params, {
      withCredentials: true,
    });
    const data = response.data;

    // Parse the response
    const slot_id = data.id_slot || data.slot_id;
    this.slots.set(model.apiUrl, slot_id);
    const stop = data.stop || false;
    const content = data.content || '';
    return [content, stop];
  }

  private preparePrompt(
    messages: Message[],
    model: Model,
    persona: Persona
  ): string {
    let usedTokens = 0;
    const maxTokens = model.maxTokens;
    const chatMl = model.chatMl;

    // Prepare our system prompt
    let systemPrompt = '';
    systemPrompt += `${chatMl.userPrepend}system${chatMl.lineSeparator}`;
    systemPrompt += `You are ${persona.name}${chatMl.lineSeparator}`;
    systemPrompt += `${persona.description}${chatMl.lineSeparator}`;
    systemPrompt += `${chatMl.stopSequence}${chatMl.lineSeparator}`;

    // Determine how many tokens we have left
    usedTokens = calculateTokenLength(systemPrompt);

    // Iterate over messagse in reverse order
    // to generate the chat log
    let chatLog = `${chatMl.userPrepend}${persona.name.toLowerCase()}${chatMl.lineSeparator}`;
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      let messageLog = '';
      messageLog += `${chatMl.userPrepend}${message.role.toLowerCase()}${chatMl.lineSeparator}`;
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
