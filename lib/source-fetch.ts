/** Shared timeout and HTTP handling for the fixed scientific-data endpoints. */
export async function fetchSourceJson<T>(
  url: string, signal: AbortSignal, timeoutMs = 10000, fetcher: typeof fetch = fetch,
): Promise<T> {
  const response = await fetcher(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  return await response.json() as T;
}
