import React, { useState } from 'react'
import { api, SCALE } from '../api.js'

// Create Resume (feature 2) — distinct from Create Template (Builder tab).
// Template + Profile + Model come ONLY from the top bar (picked first),
// then the job description is pasted here, then Generate.
export default function Generate({ templates, profiles, activeTemplateId, activeProfileId, activeModel }) {
  const [jobDescription, setJobDescription] = useState('')
  const [filled, setFilled] = useState(null)
  const [fallback, setFallback] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const templateName = templates.find((t) => t.id === activeTemplateId)?.name
  const profileName = profiles.find((p) => p.id === activeProfileId)?.name
  const modelLabel = activeModel

  async function generate() {
    if (!activeTemplateId) { setStatus('Pick a template from the dropdown at the top first.'); return }
    if (!activeProfileId) { setStatus('Pick a profile from the dropdown at the top first.'); return }
    if (!activeModel) { setStatus('Pick a model from the dropdown at the top first.'); return }
    setBusy(true); setStatus('Generating…')
    try {
      const res = await api.generate({
        template_id: activeTemplateId,
        profile_id: activeProfileId,
        job_description: jobDescription,
        model: activeModel,
      })
      setFilled(res.filled_template)
      setFallback(res.fallback)
      setStatus(res.fallback ? 'Generated with the offline filler — no API key for that model, or the model call failed. Add a key in Settings to use the live model.' : `Generated with ${res.model}.`)
    } catch (err) {
      setStatus('Generate failed: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  function updateSectionText(pageIdx, sectionId, text) {
    setFilled((prev) => {
      const next = JSON.parse(JSON.stringify(prev))
      const sec = next.pages[pageIdx].sections.find((s) => s.id === sectionId)
      if (sec) sec.text = text
      return next
    })
  }

  async function downloadPdf() {
    if (!filled) return
    try {
      const blob = await api.exportPdf(filled)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'resume.pdf'; a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setStatus('PDF export failed: ' + err.message)
    }
  }

  return (
    <div className="simple-view">
      <h2>Create Resume</h2>
      <p className="muted">
        Using — Template: <strong>{templateName || 'none selected'}</strong> · Profile: <strong>{profileName || 'none selected'}</strong> · Model: <strong>{modelLabel || 'none selected'}</strong><br />
        Change any of these in the three dropdowns at the top, then paste the job description below and Generate. A template configured once in the Builder is reused for many resumes.
      </p>
      <label>Job description
        <textarea rows={6} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the job description here…" />
      </label>
      <button onClick={generate} disabled={busy}>{busy ? 'Generating…' : 'Generate'}</button>
      {status && <p>{status}</p>}

      {filled && (
        <div>
          <h3>Filled resume — edit any section text below before export</h3>
          {fallback && <p className="muted">Offline filler was used for this version.</p>}
          {filled.pages.map((page, pi) => (
            <div key={pi}>
              <div className="a4" style={{ width: 210 * SCALE, height: 297 * SCALE, marginBottom: 16 }}>
                <svg width={210 * SCALE} height={297 * SCALE} style={{ position: 'absolute', inset: 0 }}>
                  {page.lines.map((l) => (
                    <line key={l.id} x1={l.x1 * SCALE} y1={l.y1 * SCALE} x2={l.x2 * SCALE} y2={l.y2 * SCALE} stroke={l.color} strokeWidth={l.thickness * SCALE} />
                  ))}
                </svg>
                {page.sections.map((s) => (
                  <div key={s.id} className="section-box filled" style={{
                    left: s.x * SCALE, top: s.y * SCALE, width: s.width * SCALE, height: s.height * SCALE,
                    fontFamily: s.font, fontSize: s.size * SCALE / 3, color: s.color,
                    fontWeight: s.bold ? 'bold' : 'normal', fontStyle: s.italic ? 'italic' : 'normal',
                    textAlign: s.align,
                  }}>
                    {s.text}
                  </div>
                ))}
              </div>
              {page.sections.map((s) => (
                <label key={s.id}>{s.goal || s.id}
                  <textarea rows={3} value={s.text || ''} onChange={(e) => updateSectionText(pi, s.id, e.target.value)} />
                </label>
              ))}
            </div>
          ))}
          <button onClick={downloadPdf}>Download PDF</button>
        </div>
      )}
    </div>
  )
}
