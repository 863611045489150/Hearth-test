/**
 * Owner-Provided Multi-Key Pool & Health Registry for Hearth
 * Discovers keys across free LLM providers from awesome-freellm-apis
 * (Gemini, Groq, Cerebras, SambaNova, OpenRouter, Mistral, GitHub Models).
 * Automatic failover, slot assignment, cooldowns, and health registry.
 */

import { operationalStore } from './operationalStore';
import { KeySlotHealth } from '../lib/types';
import { FREE_LLM_PROVIDERS, FreeProviderPreset } from './freeLlmCatalog';

export interface KeyConfig {
  slot: number;
  apiKey: string;
  provider: string;
  model: string;
  baseUrl?: string;
  label?: string;
}

export class KeyPoolManager {
  private keys: KeyConfig[] = [];
  private defaultProvider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  private defaultModel = process.env.AI_MODEL || 'gemini-3.8-flash';

  constructor() {
    this.discoverKeys();
  }

  /**
   * Discovers all configured keys from server environment variables
   * including native keys and awesome-freellm-apis provider keys.
   */
  public discoverKeys(): KeyConfig[] {
    const list: KeyConfig[] = [];
    let slot = 1;

    // 1. Google Gemini (AI Studio injected or owner configured)
    if (process.env.GEMINI_API_KEY) {
      list.push({
        slot: slot++,
        apiKey: process.env.GEMINI_API_KEY,
        provider: 'gemini',
        model: this.defaultModel || 'gemini-3.8-flash',
        baseUrl: FREE_LLM_PROVIDERS.gemini.baseUrl,
        label: 'Google Gemini (Free)',
      });
    }

    // 2. Groq Cloud (Free LPU)
    if (process.env.GROQ_API_KEY) {
      list.push({
        slot: slot++,
        apiKey: process.env.GROQ_API_KEY,
        provider: 'groq',
        model: process.env.GROQ_MODEL || FREE_LLM_PROVIDERS.groq.defaultModel,
        baseUrl: FREE_LLM_PROVIDERS.groq.baseUrl,
        label: 'Groq Cloud (Free LPU)',
      });
    }

    // 3. Cerebras (Ultra-fast free inference)
    if (process.env.CEREBRAS_API_KEY) {
      list.push({
        slot: slot++,
        apiKey: process.env.CEREBRAS_API_KEY,
        provider: 'cerebras',
        model: process.env.CEREBRAS_MODEL || FREE_LLM_PROVIDERS.cerebras.defaultModel,
        baseUrl: FREE_LLM_PROVIDERS.cerebras.baseUrl,
        label: 'Cerebras (Free Wafer-Scale)',
      });
    }

    // 4. SambaNova (Free 70B/72B)
    if (process.env.SAMBANOVA_API_KEY) {
      list.push({
        slot: slot++,
        apiKey: process.env.SAMBANOVA_API_KEY,
        provider: 'sambanova',
        model: process.env.SAMBANOVA_MODEL || FREE_LLM_PROVIDERS.sambanova.defaultModel,
        baseUrl: FREE_LLM_PROVIDERS.sambanova.baseUrl,
        label: 'SambaNova (Free 70B)',
      });
    }

    // 5. OpenRouter (Free DeepSeek/Llama models)
    if (process.env.OPENROUTER_API_KEY) {
      list.push({
        slot: slot++,
        apiKey: process.env.OPENROUTER_API_KEY,
        provider: 'openrouter',
        model: process.env.OPENROUTER_MODEL || FREE_LLM_PROVIDERS.openrouter.defaultModel,
        baseUrl: FREE_LLM_PROVIDERS.openrouter.baseUrl,
        label: 'OpenRouter (Free)',
      });
    }

    // 6. Mistral AI (Free tier)
    if (process.env.MISTRAL_API_KEY) {
      list.push({
        slot: slot++,
        apiKey: process.env.MISTRAL_API_KEY,
        provider: 'mistral',
        model: process.env.MISTRAL_MODEL || FREE_LLM_PROVIDERS.mistral.defaultModel,
        baseUrl: FREE_LLM_PROVIDERS.mistral.baseUrl,
        label: 'Mistral AI (Free)',
      });
    }

    // 7. GitHub Models (Free with personal token)
    if (process.env.GITHUB_TOKEN) {
      list.push({
        slot: slot++,
        apiKey: process.env.GITHUB_TOKEN,
        provider: 'github',
        model: process.env.GITHUB_MODEL || FREE_LLM_PROVIDERS.github.defaultModel,
        baseUrl: FREE_LLM_PROVIDERS.github.baseUrl,
        label: 'GitHub Models (Free)',
      });
    }

    // 8. Generic numbered pool keys: AI_API_KEY_1, AI_API_KEY_2, ... AI_API_KEY_20
    for (let i = 1; i <= 20; i++) {
      const keyVal = process.env[`AI_API_KEY_${i}`];
      if (keyVal && !list.some((k) => k.apiKey === keyVal)) {
        const slotProvider = process.env[`AI_PROVIDER_${i}`] || this.defaultProvider || 'gemini';
        const preset = FREE_LLM_PROVIDERS[slotProvider];

        list.push({
          slot: slot++,
          apiKey: keyVal,
          provider: slotProvider,
          model: process.env[`AI_MODEL_${i}`] || preset?.defaultModel || this.defaultModel || 'gemini-3.8-flash',
          baseUrl: process.env[`AI_BASE_URL_${i}`] || preset?.baseUrl,
          label: `Custom Slot #${i} (${slotProvider})`,
        });
      }
    }

    this.keys = list;

    // Sync slot entries to operational store health registry
    for (const k of this.keys) {
      operationalStore.updateKeyHealth(k.slot, {
        slot: k.slot,
        provider: k.provider,
        model: k.model,
      });
    }

    operationalStore.log('Key pool initialized with Free LLM APIs catalog', 'info', {
      totalKeys: this.keys.length,
      providers: [...new Set(this.keys.map((k) => k.provider))],
    });

    return this.keys;
  }

  public getTotalKeysCount(): number {
    return this.keys.length;
  }

  public getKeysSummary() {
    return this.keys.map((k) => ({
      slot: k.slot,
      provider: k.provider,
      model: k.model,
      label: k.label,
    }));
  }

  /**
   * Selects an eligible key for a user, respecting their assigned slot if healthy,
   * or performing automatic failover to the next healthy key in the pool.
   */
  public async selectEligibleKey(userId: string): Promise<KeyConfig | null> {
    if (this.keys.length === 0) {
      this.discoverKeys();
      if (this.keys.length === 0) {
        operationalStore.log('No AI keys configured in server environment', 'error');
        return null;
      }
    }

    // Get user's assigned slot
    let assignedSlot = await operationalStore.getUserKeySlot(userId);
    if (!assignedSlot || !this.keys.some((k) => k.slot === assignedSlot)) {
      assignedSlot = this.keys[0]?.slot || 1;
      await operationalStore.assignUserKeySlot(userId, assignedSlot);
    }

    const now = Date.now();

    // 1. Try assigned slot first if it exists and is healthy
    const assignedKey = this.keys.find((k) => k.slot === assignedSlot);
    if (assignedKey) {
      const health = await operationalStore.getKeyHealth(assignedSlot);
      if (!health || health.status === 'healthy') {
        return assignedKey;
      }
      if (health.status === 'cooldown' && health.cooldownUntil && health.cooldownUntil <= now) {
        await operationalStore.recordKeySuccess(assignedSlot);
        return assignedKey;
      }
    }

    // 2. Failover: find any healthy key in the pool
    for (const key of this.keys) {
      if (key.slot === assignedSlot) continue;
      const health = await operationalStore.getKeyHealth(key.slot);
      if (!health || health.status === 'healthy') {
        operationalStore.log('Failover to alternative free provider key slot', 'warning', {
          userId,
          originalSlot: assignedSlot,
          failoverSlot: key.slot,
          provider: key.provider,
        });
        return key;
      }
      if (health.status === 'cooldown' && health.cooldownUntil && health.cooldownUntil <= now) {
        await operationalStore.recordKeySuccess(key.slot);
        return key;
      }
    }

    // 3. Fallback: if only 1 key or all on cooldown, allow retrying the primary key
    if (assignedKey) {
      const health = await operationalStore.getKeyHealth(assignedSlot);
      if (health?.status === 'cooldown') {
        return assignedKey;
      }
    }

    operationalStore.log('All configured AI keys are currently unavailable', 'error');
    return null;
  }

  /**
   * Find next key excluding already attempted slots
   */
  public async selectFailoverKey(excludedSlots: number[]): Promise<KeyConfig | null> {
    const now = Date.now();
    for (const key of this.keys) {
      if (excludedSlots.includes(key.slot)) continue;
      const health = await operationalStore.getKeyHealth(key.slot);
      if (!health || health.status === 'healthy') {
        return key;
      }
      if (health.status === 'cooldown' && health.cooldownUntil && health.cooldownUntil <= now) {
        await operationalStore.recordKeySuccess(key.slot);
        return key;
      }
    }
    return null;
  }

  /**
   * Classify error and update key health
   */
  public async handleProviderError(
    slot: number,
    error: any
  ): Promise<{ category: 'rate_limit' | 'temporary_outage' | 'invalid_key' | 'billing_exhausted' | 'content_refusal'; userMessage: string }> {
    const errorStr = (error?.message || error?.toString() || '').toLowerCase();
    const statusCode = error?.status || error?.statusCode;

    // Rate limit (429 / RESOURCE_EXHAUSTED)
    if (statusCode === 429 || errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('resource_exhausted')) {
      await operationalStore.recordKeyFailure(slot, 'rate_limit', 60000); // 60s cooldown
      return {
        category: 'rate_limit',
        userMessage: 'Provider rate limit reached. Hearth is automatically failing over to the next free provider key.',
      };
    }

    // Invalid API key / Auth failure (401 / 403)
    if (statusCode === 401 || statusCode === 403 || errorStr.includes('api_key_invalid') || errorStr.includes('unauthenticated')) {
      await operationalStore.recordKeyFailure(slot, 'invalid_key');
      return {
        category: 'invalid_key',
        userMessage: 'Key authentication error. Hearth administrator has been notified.',
      };
    }

    // Billing / project disabled
    if (errorStr.includes('billing') || errorStr.includes('account suspended')) {
      await operationalStore.recordKeyFailure(slot, 'billing_exhausted');
      return {
        category: 'billing_exhausted',
        userMessage: 'Free tier quota exhausted for this provider. Switching to backup provider.',
      };
    }

    // Safety refusal / block
    if (errorStr.includes('safety') || errorStr.includes('blocked') || errorStr.includes('harmful')) {
      return {
        category: 'content_refusal',
        userMessage: 'The AI provider declined to generate a response for this request due to safety policies.',
      };
    }

    // Transient server outage (500 / 503 / 504 / timeout)
    await operationalStore.recordKeyFailure(slot, 'temporary_outage', 30000);
    return {
      category: 'temporary_outage',
      userMessage: 'Temporary provider network glitch. Hearth is retrying.',
    };
  }
}

export const keyPoolManager = new KeyPoolManager();
