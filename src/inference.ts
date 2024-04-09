import axios from 'axios';

import { Persona, Model, Message } from './types.js';
import { calculateTokenLength } from './utils.js';

// Simple wrapper class around basic AI inference
export class LlamaCppApiEngine {
  // Map of endpoints to active slot ids
  slots: Map<string, number> = new Map();

  constructor() {
    this.slots = new Map();
  }

  clearSlots(): void {
    this.slots.clear();
  }

  /**
   * Generate an answer to a sequence of messages
   * using the provided model and persona
   * @async
   * @generator
   * @param {Message[]} messages - The sequence of messages to generate an answer for
   * @param {Model} model - The model to use for inference
   * @param {Persona} persona - The persona to use for inference
   * @param {boolean} debug - Whether to print debug information
   */
  async *generateAnswer(
    messages: Message[],
    model: Model,
    persona: Persona,
    debug: boolean = false
  ): AsyncGenerator<{ content: string; stopped: boolean }> {
    const maxTries = model.maxTries;
    const maxPredict = model.maxPredict;
    const stop_sequences = model.promptFormat.additionalStopSequences.concat(
      model.promptFormat.stopSequence
    );

    // Prepare the prompt
    const prompt = this.preparePrompt(messages, model, persona);

    if (debug) {
      console.log(
        'libertai-js::LlamaCppApiEngine::generateAnswer::prompt',
        prompt
      );
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
        console.log(
          'libertai-js::LlamaCppApiEngine::generateAnswer -- completion: ',
          lastResult
        );
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

  /* Utils */

  /* Generate the next completion of a prompt */
  private async complete(
    prompt: string,
    model: Model
  ): Promise<[string, boolean]> {
    const promptFormat = model.promptFormat;
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
      stop: [
        promptFormat.stopSequence,
        ...promptFormat.additionalStopSequences,
      ],
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
    const promptFormat = model.promptFormat;

    // Prepare our system prompt
    let systemPrompt = '';
    systemPrompt += `${promptFormat.userPrepend}system${promptFormat.lineSeparator}`;
    systemPrompt += `You are ${persona.name}${promptFormat.lineSeparator}`;
    systemPrompt += `${persona.description}${promptFormat.lineSeparator}`;
    systemPrompt += `${promptFormat.stopSequence}${promptFormat.lineSeparator}`;

    // Determine how many tokens we have left
    usedTokens = calculateTokenLength(systemPrompt);

    // Iterate over messagse in reverse order
    // to generate the chat log
    let chatLog = `${promptFormat.userPrepend}${persona.name.toLowerCase()}${promptFormat.lineSeparator}`;
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const timestamp_string = message.timestamp
        ? ` (at ${message.timestamp.toISOString})`
        : '';
      let messageLog = '';
      messageLog += `${promptFormat.userPrepend}${message.role.toLowerCase()}${timestamp_string}${promptFormat.lineSeparator}`;
      messageLog += `${message.content}${promptFormat.lineSeparator}`;
      messageLog += `${promptFormat.stopSequence}${promptFormat.lineSeparator}`;

      const messageTokens = calculateTokenLength(messageLog);
      if (usedTokens + messageTokens <= maxTokens) {
        chatLog = `${messageLog}${chatLog}`;
        usedTokens += messageTokens;
      } else {
        console.warn(
          `libertai-js::LlamaCppApiEngine::preparePrompt -- message truncated due to token limit`
        );
        break;
      }
    }

    // Generate the prompt
    const prompt = `${systemPrompt}${chatLog}`;
    return prompt;
  }
}
