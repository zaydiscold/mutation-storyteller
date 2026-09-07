import { generateText } from 'ai';
import { resolveProvider } from '@/lib/providers';
import { providerError } from '@/lib/provider-options';

export const maxDuration = 30;
export async function GET() {
  let freeModels: Array<{ id: string; name: string }> = [];
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(6000), next: { revalidate: 3600 } });
    if (response.ok) {
      const catalog = await response.json();
      freeModels = (catalog.data || []).filter((m: { id: string; pricing?: { prompt: string; completion: string }; supported_parameters?: string[] }) =>
        m.id?.endsWith(':free') && Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0 && m.supported_parameters?.includes('tools'))
        .map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })).slice(0, 40);
    }
  } catch { /* Keep the free router available when the catalog cannot be fetched. */ }
  return Response.json({ freeModels,
    hostedConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()),
    hostedProvider: process.env.OPENROUTER_API_KEY?.trim() ? 'openrouter' : 'google',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: Request) {
  let provider;
  try { provider = resolveProvider(req.headers); }
  catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
  try {
    await generateText({ model: provider.model, prompt: 'Reply with OK.', maxOutputTokens: 16, maxRetries: 0, abortSignal: AbortSignal.any([req.signal, AbortSignal.timeout(20000)]) });
    return Response.json({ message: `Connected to ${provider.provider} / ${provider.modelId}.`, model: provider.modelId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: providerError(error) }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
