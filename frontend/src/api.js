async function req(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

export const api = {
  health: () => req('/api/health'),
  models: () => req('/api/models'),
  providers: () => req('/api/providers'),
  getSettings: () => req('/api/settings'),
  saveSettings: (body) => req('/api/settings/api-keys', { method: 'POST', body: JSON.stringify(body) }),
  templates: () => req('/api/templates'),
  getTemplate: (id) => req(`/api/templates/${id}`),
  createTemplate: (body) => req('/api/templates', { method: 'POST', body: JSON.stringify(body) }),
  saveTemplate: (id, body) => req(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTemplate: (id) => req(`/api/templates/${id}`, { method: 'DELETE' }),
  profiles: () => req('/api/profiles'),
  getProfile: (id) => req(`/api/profiles/${id}`),
  deleteProfile: (id) => req(`/api/profiles/${id}`, { method: 'DELETE' }),
  createProfileText: (body) => req('/api/profiles/text', { method: 'POST', body: JSON.stringify(body) }),
  uploadProfile: async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/profiles', { method: 'POST', body: fd })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },
  generate: (body) => req('/api/generate', { method: 'POST', body: JSON.stringify(body) }),
  exportPdf: async (filledTemplate) => {
    const res = await fetch('/api/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filled_template: filledTemplate }),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.blob()
  },
}

export const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`
export const SCALE = 3 // 1mm = 3px, so A4 = 630 x 891 px
