import axios from 'axios';

import { Message, Model, Persona } from './types.js';
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
   * @param {string[]} knowledgeSearchResults - Knowledge bases content to help the model answer correctly
   * @param {string} targetUser - The user to generate the answer for, if different from Message[-1].role
   * @param {boolean} debug - Whether to print debug information
   */
  async *generateAnswer(
    messages: Message[],
    model: Model,
    persona: Persona,
    knowledgeSearchResults: string[] = [],
    targetUser: string | null = null,
    debug: boolean = false
  ): AsyncGenerator<{ content: string; stopped: boolean; thought: string }> {
    const maxTries = model.maxTries;
    const maxPredict = model.maxPredict;
    const stop_sequences = model.promptFormat.additionalStopSequences.concat(
      model.promptFormat.stopSequence
    );

    // Prepare the prompt
    const prompt = this.preparePrompt(
      messages,
      model,
      persona,
      targetUser,
      knowledgeSearchResults
    );

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
      for (const element of stop_sequences) {
        fullResults = fullResults.split(`\n${element}`).join('|||||');
        fullResults = fullResults.split(`${element}`).join('|||||');
      }
      const results = fullResults.split('|||||');

      compoundedResult = results[0].trimEnd();
      const thought = this.extractThought(fullResults);

      if (
        thought.length == 0 &&
        (results.length > 1 || lastResult.length < maxPredict)
      ) {
        stopped = true;
      } else {
        stopped = false;
      }

      yield {
        content: this.extractContent(compoundedResult),
        stopped,
        thought,
      };
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
      withCredentials: model.withCredentials,
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
    persona: Persona,
    // Allow caller to specify a target user, if different from Message[-1].role
    targetUser: string | null = null,
    knowledgeSearchResults: string[]
  ): string {
    const maxTokens = model.maxTokens;
    const promptFormat = model.promptFormat;

    // Get the target user
    if (targetUser === null) {
      targetUser = messages[messages.length - 1].role;
    }

    // Set {{char}} based on persona.role
    // Set {{user}} based on targetUser
    // Set {{model}} based on model.name
    let description = persona.description;
    description = description.replace(/\{\{char\}\}/g, persona.role);
    description = description.replace(/\{\{user\}\}/g, targetUser);
    description = description.replace(/\{\{model\}\}/g, model.name);

    // Prepare our system prompt
    let systemPrompt =
      knowledgeSearchResults.length > 0
        ? `You have access to the following information to help you: ${knowledgeSearchResults.join(promptFormat.lineSeparator)}`
        : '';
    systemPrompt += `${promptFormat.userPrepend}system${promptFormat.userAppend}`;
    systemPrompt += `${description}`;
    systemPrompt += `${promptFormat.stopSequence}${promptFormat.logStart}`;
    systemPrompt += `${promptFormat.lineSeparator}`;

    // Determine how many tokens we have left
    let usedTokens = calculateTokenLength(systemPrompt);

    // Iterate over messages in reverse order
    // to generate the chat log
    let chatLog = `${promptFormat.userPrepend}${persona.role.toLowerCase()}${promptFormat.userAppend}`;
    for (const message of messages.reverse()) {
      let messageLog = '';
      messageLog += `${promptFormat.userPrepend}${message.role.toLowerCase()}${promptFormat.userAppend}`;
      messageLog += `${message.content}`;
      messageLog += `${promptFormat.stopSequence}`;
      messageLog += `${promptFormat.lineSeparator}`;

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

  extractContent(data: string): string {
    if (data.indexOf('<think>') != -1 && data.indexOf('</think>') != -1) {
      const stopPos = data.indexOf('</think>');

      return data.substring(stopPos + '</think>'.length);
    } else if (data.indexOf('<think>') != -1) {
      return '';
    }

    return '' + data;
  }

  extractThought(data: string): string {
    if (data.indexOf('<think>') != -1 && data.indexOf('</think>') != -1) {
      const startPos = data.indexOf('<think>') + '<think>'.length;
      const stopPos = data.indexOf('</think>');

      return data.substring(startPos, stopPos);
    } else if (data.indexOf('<think>') != -1) {
      const startPos = data.indexOf('<think>') + '<think>'.length;

      return data.substring(startPos);
    }

    return '';
  }
}
