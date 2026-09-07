import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { DEFAULT_MODELS, readProviderOptions } from './provider-options';

export function resolveProvider(headers: Headers) {
  const options = readProviderOptions(headers);
  const hosted = options.provider === 'server';
  const provider = hosted ? (process.env.OPENROUTER_API_KEY?.trim() ? 'openrouter' : 'google') : options.provider === 'openrouter' ? 'openrouter' : 'google';
  const apiKey = hosted ? (provider === 'google' ? process.env.GOOGLE_GENERATIVE_AI_API_KEY : process.env.OPENROUTER_API_KEY)?.trim() : options.apiKey;
  if (!apiKey) throw new Error('Hosted research is not configured. Open Model settings and bring your own Gemini or OpenRouter key.');
  // Client model overrides never spend the hosted account's credits.
  const modelId = hosted ? (provider === 'google' ? process.env.GEMINI_MODEL : process.env.OPENROUTER_MODEL)?.trim() || DEFAULT_MODELS[provider] : options.model || DEFAULT_MODELS[provider];
  const model = provider === 'google'
    ? createGoogleGenerativeAI({ apiKey })(modelId)
    : createOpenAICompatible({ name: 'openrouter', apiKey, baseURL: 'https://openrouter.ai/api/v1' }).chatModel(modelId);
  return { model, modelId, provider, depth: options.depth, hosted };
}
