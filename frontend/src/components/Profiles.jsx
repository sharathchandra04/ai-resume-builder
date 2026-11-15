import React, { useState } from 'react'
import { api } from '../api.js'

export default function Profiles({ profiles, setProfiles }) {
  const [preview, setPreview] = useState(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState('')

  async function refresh() {
    setProfiles(await api.profiles())
  }

  async function onUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await api.uploadProfile(file)
      await refresh()
      setStatus(`Uploaded ${file.name}.`)
    } catch (err) {
      setStatus('Upload failed: ' + err.message)
    }
    e.target.value = ''
  }

  async function addTextProfile() {
    if (!name.trim() || !content.trim()) { setStatus('Give the profile a name and paste its text.'); return }
    try {
      await api.createProfileText({ name: name.trim(), content })
      setName(''); setContent('')
      await refresh()
      setStatus('Profile added.')
    } catch (err) {
      setStatus('Failed: ' + err.message)
    }
  }

  return (
    <div className="simple-view">
      <h2>Profiles</h2>
      <p className="muted">Profiles are plain text files. Add as many as you like — pick the active one from the dropdown at the top of the page.</p>
      <label>Upload a .txt profile <input type="file" accept=".txt" onChange={onUpload} /></label>
      <h3>Or paste one</h3>
      <label>Name <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Software Engineer profile" /></label>
      <label>Profile text <textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Name, contact, experience, skills, education…" /></label>
      <button onClick={addTextProfile}>Add profile</button>
      {status && <p>{status}</p>}
      <h3>Saved profiles</h3>
      {profiles.length === 0 && <p className="muted">No profiles yet.</p>}
      {profiles.map((p) => (
        <div key={p.id} className="list-item">
          <strong>{p.name}</strong>
          <button onClick={async () => setPreview(await api.getProfile(p.id))}>Preview</button>
          <button className="danger" onClick={async () => { if (window.confirm(`Delete profile "${p.name}"?`)) { await api.deleteProfile(p.id); await refresh() } }}>Delete</button>
        </div>
      ))}
      {preview && (
        <div>
          <h3>{preview.name}</h3>
          <pre className="profile-preview">{preview.content}</pre>
          <button onClick={() => setPreview(null)}>Close preview</button>
        </div>
      )}
    </div>
  )
}
