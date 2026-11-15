import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import Builder from './components/Builder.jsx'
import Profiles from './components/Profiles.jsx'
import Generate from './components/Generate.jsx'
import Settings from './components/Settings.jsx'

export default function App() {
  const [tab, setTab] = useState('builder')
  const [templates, setTemplates] = useState([])
  const [profiles, setProfiles] = useState([])
  // Top bar: three dropdowns, always visible, side by side.
  // 1 Template, 2 Profile, 3 Model — picked first, then the job
  // description in the Generate tab, then Generate.
  const [activeTemplateId, setActiveTemplateId] = useState('')
  const [activeProfileId, setActiveProfileId] = useState('')
  const [activeModel, setActiveModel] = useState('')
  const [models, setModels] = useState([])
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [t, p, m, s] = await Promise.all([
          api.templates(), api.profiles(), api.models(), api.getSettings(),
        ])
        setTemplates(t); setProfiles(p); setModels(m); setSettings(s)
        if (t.length > 0) setActiveTemplateId(t[0].id)
        if (p.length > 0) setActiveProfileId(p[0].id)
        if (s?.model) setActiveModel(s.model)
      } catch (err) {
        setError('Could not reach the backend at http://localhost:8000 — start it first (see README). ' + err.message)
      }
    }
    load()
  }, [])

  // Keep the top-bar template in sync if the template list changes
  // (e.g. the active one was deleted).
  useEffect(() => {
    if (templates.length > 0 && !templates.some((t) => t.id === activeTemplateId)) {
      setActiveTemplateId(templates[0].id)
    }
  }, [templates])

  return (
    <div>
      <header className="topbar">
        <h1>AI Resume Builder</h1>
        <label className="top-picker">Template
          <select value={activeTemplateId} onChange={(e) => setActiveTemplateId(e.target.value)}>
            {templates.length === 0 && <option value="">No templates yet</option>}
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="top-picker">Profile
          <select value={activeProfileId} onChange={(e) => setActiveProfileId(e.target.value)}>
            {profiles.length === 0 && <option value="">No profiles yet</option>}
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="top-picker">Model
          <select value={activeModel} onChange={(e) => setActiveModel(e.target.value)}>
            {models.length === 0 && <option value="">Loading…</option>}
            {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
      </header>
      <nav className="tabs">
        {['builder', 'profiles', 'generate', 'settings'].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>
      {error && <p className="error">{error}</p>}
      <main>
        {tab === 'builder' && (
          <Builder
            templates={templates} setTemplates={setTemplates}
            activeTemplateId={activeTemplateId} onTemplateSelect={setActiveTemplateId}
          />
        )}
        {tab === 'profiles' && <Profiles profiles={profiles} setProfiles={setProfiles} />}
        {tab === 'generate' && (
          <Generate
            templates={templates} profiles={profiles}
            activeTemplateId={activeTemplateId} activeProfileId={activeProfileId} activeModel={activeModel}
          />
        )}
        {tab === 'settings' && (
          <Settings
            models={models} settings={settings} setSettings={setSettings}
            activeModel={activeModel} onModelChange={setActiveModel}
          />
        )}
      </main>
    </div>
  )
}
