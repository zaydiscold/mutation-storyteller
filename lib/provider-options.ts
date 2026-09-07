export type ProviderName = 'server' | 'google' | 'openrouter';
export interface ProviderSettings {
  provider: ProviderName;
  model: string;
  apiKey: string;
  depth: 'overview' | 'detailed';
}
export const DEFAULT_SETTINGS: ProviderSettings = { provider: 'server', model: '', apiKey: '', depth: 'detailed' };
export const DEFAULT_MODELS = { google: 'gemini-2.5-flash', openrouter: 'openrouter/free' };

export function providerHeaders(settings: ProviderSettings): Record<string, string> {
  const headers: Record<string, string> = { 'x-rosie-provider': settings.provider, 'x-rosie-depth': settings.depth };
  if (settings.provider !== 'server') {
    headers['x-rosie-key'] = settings.apiKey.trim();
    headers['x-rosie-model'] = settings.model.trim() || DEFAULT_MODELS[settings.provider];
  }
  return headers;
}

export function readProviderOptions(headers: Headers) {
  const provider = headers.get('x-rosie-provider') || 'server';
  const apiKey = headers.get('x-rosie-key')?.trim() || '';
  const model = headers.get('x-rosie-model')?.trim() || '';
  const depth = headers.get('x-rosie-depth') || 'detailed';
  if (!['server', 'google', 'openrouter'].includes(provider)) throw new Error('Choose Gemini, OpenRouter, or the hosted provider.');
  if (!['overview', 'detailed'].includes(depth)) throw new Error('Choose overview or detailed report.');
  if (model.length > 160 || (model && !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(model))) throw new Error('Enter a valid model ID.');
  if (apiKey.length > 512 || /[^\x21-\x7E]/.test(apiKey)) throw new Error('The API key contains invalid characters.');
  if (provider !== 'server' && !apiKey) throw new Error('Enter your API key in Model settings first.');
  return { provider: provider as ProviderName, model, apiKey, depth };
}

export function providerError(error: unknown): string {
  const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined;
  if (status === 401 || status === 403 || status === 400) return 'The provider rejected the key or request. Check your key and model in Model settings.';
  if (status === 402) return 'The provider requires credits for this model. Choose a free model or check your provider account.';
  if (status === 404) return 'This model is unavailable. Choose another model in Model settings.';
  if (status === 429) return 'Provider quota or rate limit reached. Wait and retry, or use another key or model.';
  return 'The provider could not complete the request. Check your connection and model, then retry.';
}
