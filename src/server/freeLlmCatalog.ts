/**
 * Curated Free LLM APIs Catalog & Presets
 * Grounded in awesome-freellm-apis
 * Providers with permanent free tiers, no credit cards required.
 */

export interface FreeProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  freeModels: string[];
  rpm: number;
  rpd?: number;
  envVar: string;
  signUpUrl: string;
  notes: string;
}

export const FREE_LLM_PROVIDERS: Record<string, FreeProviderPreset> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-3.8-flash',
    freeModels: ['gemini-3.8-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'],
    rpm: 15,
    rpd: 1500,
    envVar: 'GEMINI_API_KEY',
    signUpUrl: 'https://aistudio.google.com/app/apikey',
    notes: 'Google AI Studio free tier. Multimodal, generous token limits.',
  },
  groq: {
    id: 'groq',
    name: 'Groq Cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    freeModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    rpm: 30,
    rpd: 14400,
    envVar: 'GROQ_API_KEY',
    signUpUrl: 'https://console.groq.com/keys',
    notes: 'Ultra-fast LPU inference. Extremely popular for fast free chat.',
  },
  cerebras: {
    id: 'cerebras',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    defaultModel: 'llama3.3-70b',
    freeModels: ['llama3.3-70b', 'llama3.1-8b'],
    rpm: 30,
    rpd: 1000000,
    envVar: 'CEREBRAS_API_KEY',
    signUpUrl: 'https://cloud.cerebras.ai',
    notes: 'Wafer-scale engine with up to 2000 tokens/sec free generation.',
  },
  sambanova: {
    id: 'sambanova',
    name: 'SambaNova Cloud',
    baseUrl: 'https://api.sambanova.ai/v1',
    defaultModel: 'Meta-Llama-3.3-70B-Instruct',
    freeModels: ['Meta-Llama-3.3-70B-Instruct', 'Meta-Llama-3.1-8B-Instruct', 'Qwen2.5-72B-Instruct'],
    rpm: 20,
    envVar: 'SAMBANOVA_API_KEY',
    signUpUrl: 'https://cloud.sambanova.ai',
    notes: 'Full parameter precision 70B and 72B free models.',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter Free Tier',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'deepseek/deepseek-r1:free',
    freeModels: [
      'deepseek/deepseek-r1:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
    ],
    rpm: 20,
    rpd: 200,
    envVar: 'OPENROUTER_API_KEY',
    signUpUrl: 'https://openrouter.ai/keys',
    notes: 'Aggregated free models including DeepSeek-R1 and Llama 3.3.',
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI (La Plateforme)',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    freeModels: ['mistral-small-latest', 'open-mistral-7b', 'codestral-latest'],
    rpm: 60,
    envVar: 'MISTRAL_API_KEY',
    signUpUrl: 'https://console.mistral.ai',
    notes: 'European frontier models with generous free experimental tier.',
  },
  github: {
    id: 'github',
    name: 'GitHub Models',
    baseUrl: 'https://models.inference.ai.azure.com',
    defaultModel: 'gpt-4o-mini',
    freeModels: ['gpt-4o-mini', 'Phi-3.5-mini-instruct'],
    rpm: 15,
    rpd: 150,
    envVar: 'GITHUB_TOKEN',
    signUpUrl: 'https://github.com/marketplace/models',
    notes: 'Free with personal GitHub account access token.',
  },
};
