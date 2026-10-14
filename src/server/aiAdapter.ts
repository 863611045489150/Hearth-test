/**
 * Universal Multi-Provider AI Adapter for Hearth
 * Supports Google Gemini (via @google/genai) AND all OpenAI-compatible free providers
 * from awesome-freellm-apis (Groq, Cerebras, SambaNova, OpenRouter, Mistral, GitHub Models).
 */

import { GoogleGenAI } from '@google/genai';
import { keyPoolManager, KeyConfig } from './keyPool';
import { operationalStore } from './operationalStore';

export interface ChatMessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GenerationResult {
  text: string;
  modelUsed: string;
  slotUsed: number;
  provider: string;
}

const DEFAULT_SYSTEM_INSTRUCTION = `You are Hearth, a quiet, thoughtful, and articulate AI thinking workspace created by Aarush Gupta.
Provide deep, well-reasoned, concise, and structured answers. Avoid unnecessary conversational filler, excessive enthusiasm, or generic AI disclaimers.
Focus on clarity, intellectual honesty, elegant formatting, and insightful analysis.`;

export class AIAdapter {
  /**
   * Generates response with automatic failover across free key pool
   */
  public async generateWithFailover(
    userId: string,
    messages: ChatMessageInput[],
    systemInstruction?: string,
    onChunk?: (text: string) => void
  ): Promise<GenerationResult> {
    const attemptedSlots: number[] = [];
    const totalKeys = keyPoolManager.getTotalKeysCount();

    if (totalKeys === 0) {
      keyPoolManager.discoverKeys();
      if (keyPoolManager.getTotalKeysCount() === 0) {
        throw new Error(
          'Hearth is currently awaiting owner AI key configuration. Your free test responses have not been consumed.'
        );
      }
    }

    const maxAttempts = Math.min(3, Math.max(1, keyPoolManager.getTotalKeysCount()));
    let lastErrorMessage = 'Unable to generate response at this time.';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let keyConfig: KeyConfig | null = null;

      if (attempt === 1) {
        keyConfig = await keyPoolManager.selectEligibleKey(userId);
      } else {
        keyConfig = await keyPoolManager.selectFailoverKey(attemptedSlots);
      }

      if (!keyConfig) {
        break;
      }

      attemptedSlots.push(keyConfig.slot);

      try {
        const result = await this.executeSingleRequest(keyConfig, messages, systemInstruction, onChunk);
        // Mark key healthy on success
        await operationalStore.recordKeySuccess(keyConfig.slot);
        return result;
      } catch (err: any) {
        console.error(`[AIAdapter] Slot #${keyConfig.slot} (${keyConfig.provider}) failed attempt ${attempt}:`, err?.message || err);
        const errorInfo = await keyPoolManager.handleProviderError(keyConfig.slot, err);
        lastErrorMessage = errorInfo.userMessage;

        // Content refusal / safety blocks shouldn't retry across other keys
        if (errorInfo.category === 'content_refusal') {
          throw new Error(errorInfo.userMessage);
        }
      }
    }

    throw new Error(`All available AI keys are temporarily busy. ${lastErrorMessage}`);
  }

  private async executeSingleRequest(
    keyConfig: KeyConfig,
    messages: ChatMessageInput[],
    systemInstruction?: string,
    onChunk?: (text: string) => void
  ): Promise<GenerationResult> {
    // 1. Native Google Gemini Provider
    if (keyConfig.provider === 'gemini') {
      return this.executeGeminiRequest(keyConfig, messages, systemInstruction, onChunk);
    }

    // 2. OpenAI-Compatible Free Providers (Groq, Cerebras, SambaNova, OpenRouter, Mistral, GitHub)
    return this.executeOpenAICompatibleRequest(keyConfig, messages, systemInstruction, onChunk);
  }

  /**
   * Execute Google Gemini via @google/genai SDK
   */
  private async executeGeminiRequest(
    keyConfig: KeyConfig,
    messages: ChatMessageInput[],
    systemInstruction?: string,
    onChunk?: (text: string) => void
  ): Promise<GenerationResult> {
    const ai = new GoogleGenAI({ apiKey: keyConfig.apiKey });
    const model = keyConfig.model || 'gemini-3.8-flash';

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    if (onChunk) {
      try {
        const responseStream = await ai.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction: systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
            temperature: 0.7,
          },
        });

        let fullText = '';
        for await (const chunk of responseStream) {
          const chunkText = chunk.text || '';
          if (chunkText) {
            fullText += chunkText;
            onChunk(chunkText);
          }
        }

        return {
          text: fullText,
          modelUsed: model,
          slotUsed: keyConfig.slot,
          provider: 'Google Gemini',
        };
      } catch (streamErr: any) {
        console.warn('[AIAdapter] Gemini streaming fallback to generateContent:', streamErr?.message || streamErr);
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
            temperature: 0.7,
          },
        });

        const text = response.text || '';
        onChunk(text);
        return {
          text,
          modelUsed: model,
          slotUsed: keyConfig.slot,
          provider: 'Google Gemini',
        };
      }
    } else {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
          temperature: 0.7,
        },
      });

      return {
        text: response.text || '',
        modelUsed: model,
        slotUsed: keyConfig.slot,
        provider: 'Google Gemini',
      };
    }
  }

  /**
   * Execute OpenAI-Compatible Free Providers (Groq, Cerebras, SambaNova, OpenRouter, Mistral, GitHub)
   */
  private async executeOpenAICompatibleRequest(
    keyConfig: KeyConfig,
    messages: ChatMessageInput[],
    systemInstruction?: string,
    onChunk?: (text: string) => void
  ): Promise<GenerationResult> {
    const baseUrl = (keyConfig.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const endpoint = `${baseUrl}/chat/completions`;

    const formattedMessages = [
      { role: 'system', content: systemInstruction || DEFAULT_SYSTEM_INSTRUCTION },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const bodyPayload = {
      model: keyConfig.model,
      messages: formattedMessages,
      temperature: 0.7,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keyConfig.apiKey}`,
    };

    // GitHub models or OpenRouter optional headers
    if (keyConfig.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://hearth.app';
      headers['X-Title'] = 'Hearth';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedMessage = errText;
      try {
        const jsonErr = JSON.parse(errText);
        parsedMessage = jsonErr.error?.message || errText;
      } catch {
        // use raw errText
      }
      const err = new Error(parsedMessage);
      (err as any).status = response.status;
      throw err;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    if (onChunk && text) {
      onChunk(text);
    }

    return {
      text,
      modelUsed: keyConfig.model,
      slotUsed: keyConfig.slot,
      provider: keyConfig.label || keyConfig.provider,
    };
  }
}

export const aiAdapter = new AIAdapter();
