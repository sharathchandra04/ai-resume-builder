import React, { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Settings({ models, settings, setSettings, activeModel, onModelChange }) {
  const [providers, setProviders] = useState([])
  const [keys, setKeys] = useState({})
  const [status, setStatus] = useState('')

  useEffect(() => {
    api.providers().then(setProviders).catch(() => {})
  }, [])

  async function save() {
    try {
      // The model dropdown here is the same top-bar model selection,
      // kept in sync via activeModel / onModelChange.
      const res = await api.saveSettings({ model: activeModel, api_keys: keys })
      setSettings(res)
      setKeys({})
      setStatus('Settings saved.')
    } catch (err) {
      setStatus('Save failed: ' + err.message)
    }
  }

  return (
    <div className="simple-view">
      <h2>Settings</h2>
      <label>Model
        <select value={activeModel || ''} onChange={(e) => onModelChange && onModelChange(e.target.value)}>
          {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </label>
      <p className="muted">Same model as the top-bar dropdown — changing it here changes it there too. Grok is the default.</p>

      <h3>API key</h3>
      <p className="muted">Type your key in the app here — one field per provider. Only the key for the model you picked is needed. Keys are stored on the backend only, never in a template, and never shown back to you.</p>
      {providers.map((p) => (
        <label key={p.id}>{p.label}
          <input
            type="password"
            placeholder={settings?.providers_with_key?.includes(p.id) ? 'Key saved — enter a new one to replace it' : 'Paste API key here'}
            value={keys[p.id] || ''}
            onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })}
          />
          {settings?.providers_with_key?.includes(p.id) && <span className="muted"> ✓ key saved</span>}
        </label>
      ))}
      <button onClick={save}>Save settings</button>
      {status && <p>{status}</p>}
    </div>
  )
}
