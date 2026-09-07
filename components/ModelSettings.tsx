'use client';
import { useEffect, useState } from 'react';
import { DEFAULT_MODELS, DEFAULT_SETTINGS, providerHeaders, type ProviderSettings, type ProviderName } from '@/lib/provider-options';

export function ModelSettings({ value, onChange, disabled }: { value: ProviderSettings; onChange: (settings: ProviderSettings) => void; disabled: boolean }) {
  const [status, setStatus] = useState('');
  const [checking, setChecking] = useState(false);
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => { const controller = new AbortController(); void fetch('/api/providers', { signal: controller.signal }).then(r => r.json()).then(data => setModels(data.freeModels || [])).catch(() => {}); return () => controller.abort(); }, []);
  function update(change: Partial<ProviderSettings>) { setStatus(''); onChange({ ...value, ...change }); }
  async function check() {
    setChecking(true); setStatus('Checking connection...');
    try {
      const response = await fetch('/api/providers', { method: 'POST', headers: providerHeaders(value), signal: AbortSignal.timeout(25000) });
      const result = await response.json(); setStatus(result.error || result.message);
    } catch { setStatus('Connection check timed out or failed. Try again.'); }
    finally { setChecking(false); }
  }
  return <details className="settings-panel">
    <summary>Model settings <span>{value.provider === 'server' ? 'Hosted provider' : value.provider === 'google' ? 'Your Gemini key' : 'Your OpenRouter key'} · {value.depth}</span></summary>
    <fieldset disabled={disabled || checking}>
      <div className="settings-grid">
        <label>Provider<select aria-label="Provider" value={value.provider} onChange={e => { const provider = e.target.value as ProviderName; update({ provider, apiKey: '', model: provider === 'server' ? '' : DEFAULT_MODELS[provider] }); }}>
          <option value="server">Hosted provider</option><option value="openrouter">OpenRouter (your key)</option><option value="google">Gemini (your key)</option>
        </select></label>
        <label>Report depth<select aria-label="Report depth" value={value.depth} onChange={e => update({ depth: e.target.value as ProviderSettings['depth'] })}><option value="overview">Quick overview</option><option value="detailed">Detailed evidence review</option></select></label>
        {value.provider !== 'server' && <>
          <label>API key<input type="password" autoComplete="off" spellCheck={false} value={value.apiKey} onChange={e => update({ apiKey: e.target.value })} placeholder="Paste your provider key" /></label>
          <label>Model ID<input value={value.model} spellCheck={false} onChange={e => update({ model: e.target.value })} placeholder={DEFAULT_MODELS[value.provider]} /></label>
        </>}
      </div>
      {value.provider === 'openrouter' && <label>Available free models<select aria-label="Available free models" value={value.model === 'openrouter/free' || models.some(m => m.id === value.model) ? value.model : ''} onChange={e => { if (e.target.value) update({ model: e.target.value }); }}><option value="">Custom model (enter ID above)</option><option value="openrouter/free">Free router (automatic selection)</option>{models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
      <p className="small-note">Keys stay in this tab’s memory and clear on refresh. Requests pass through this server to your selected provider. Your question and retrieved evidence are sent to that provider. Keys are not saved by the app.</p>
      {value.provider === 'openrouter' && <p className="small-note"><a href="https://openrouter.ai/openrouter/free" target="_blank" rel="noreferrer">openrouter/free</a> selects an available free model with tool support. Availability and quotas vary. Custom models may incur charges on your account.</p>}
      <div className="control-row"><button className="example-btn" type="button" onClick={check}>Test connection</button><button className="example-btn" type="button" onClick={() => { onChange(DEFAULT_SETTINGS); setStatus('Key cleared.'); }}>Clear key</button></div>
    </fieldset>
    {status && <p role="status" className="small-note">{status}</p>}
  </details>;
}
