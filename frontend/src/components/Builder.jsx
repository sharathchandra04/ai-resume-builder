import React, { useEffect, useState } from 'react'
import { api, uid, SCALE } from '../api.js'

const FONTS = ['Arial', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana']

function blankTemplate(name) {
  return { id: '', name: name || 'Untitled template', pages: [{ lines: [], sections: [] }] }
}

// Create Template (feature 1) — interactive, many templates:
// New Template (blank A4, or duplicate an existing one), draw
// lines/sections on the 10mm grid, configure each one, add pages,
// rename, save, delete. Every saved template appears in the top-bar
// Template dropdown.
export default function Builder({ templates, setTemplates, activeTemplateId, onTemplateSelect }) {
  const [template, setTemplate] = useState(null)
  const [pageIdx, setPageIdx] = useState(0)
  const [mode, setMode] = useState('section') // line | section
  const [points, setPoints] = useState([])
  const [selected, setSelected] = useState(null) // {kind:'line'|'section', id}
  const [showGrid, setShowGrid] = useState(true)
  const [status, setStatus] = useState('')

  const page = template?.pages?.[pageIdx]

  // The Builder's currently-open template is reflected in the top
  // Template dropdown, and vice versa: picking a template up top
  // opens it here for editing.
  useEffect(() => {
    if (!activeTemplateId) return
    if (template && template.id === activeTemplateId) return
    const t = templates.find((x) => x.id === activeTemplateId)
    if (t) openTemplate(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTemplateId, templates])
  const selectedEl = (() => {
    if (!selected || !page) return null
    const list = selected.kind === 'line' ? page.lines : page.sections
    return list.find((el) => el.id === selected.id) || null
  })()

  function openTemplate(t) {
    setTemplate(JSON.parse(JSON.stringify(t)))
    setPageIdx(0)
    setPoints([])
    setSelected(null)
    setStatus('')
    if (onTemplateSelect && t.id) onTemplateSelect(t.id)
  }

  function newTemplate() {
    const name = window.prompt('Template name:', `Template ${templates.length + 1}`)
    if (name === null) return // cancelled
    const t = blankTemplate(name.trim() || 'Untitled template')
    setTemplate(t)
    setPageIdx(0)
    setPoints([])
    setSelected(null)
    setStatus('New blank A4 page — draw lines/sections, then Save template.')
  }

  async function duplicateTemplate(t) {
    const copy = JSON.parse(JSON.stringify(t))
    copy.id = ''
    copy.name = `${t.name} (copy)`
    const saved = await api.createTemplate({ name: copy.name, pages: copy.pages })
    setTemplates(await api.templates())
    openTemplate(saved)
    setStatus(`Duplicated as "${saved.name}".`)
  }

  function updatePage(mutator) {
    setTemplate((prev) => {
      const next = JSON.parse(JSON.stringify(prev))
      mutator(next.pages[pageIdx])
      return next
    })
  }

  function updateSelected(patch) {
    if (!selected) return
    updatePage((p) => {
      const list = selected.kind === 'line' ? p.lines : p.sections
      const el = list.find((e) => e.id === selected.id)
      if (el) Object.assign(el, patch)
    })
  }

  function onPageClick(e) {
    if (!template) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mmX = Math.max(0, Math.min(210, Math.round(((e.clientX - rect.left) / SCALE) / 10) * 10))
    const mmY = Math.max(0, Math.min(297, Math.round(((e.clientY - rect.top) / SCALE) / 10) * 10))
    // Clicking an existing element is handled by that element's onClick (stopPropagation).
    const nextPoints = [...points, { x: mmX, y: mmY }]
    if (mode === 'line' && nextPoints.length === 2) {
      const [a, b] = nextPoints
      updatePage((p) => p.lines.push({ id: uid('line'), x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: '#000000', thickness: 1 }))
      setPoints([])
    } else if (mode === 'section' && nextPoints.length === 4) {
      const xs = nextPoints.map((p) => p.x)
      const ys = nextPoints.map((p) => p.y)
      const x = Math.min(...xs), y = Math.min(...ys)
      const w = Math.max(...xs) - x, h = Math.max(...ys) - y
      if (w > 0 && h > 0) {
        updatePage((p) => p.sections.push({
          id: uid('sec'), x, y, width: w, height: h, type: 'paragraph',
          font: 'Arial', size: 11, color: '#000000', bold: false, italic: false,
          align: 'left', goal: '', text: '',
        }))
      }
      setPoints([])
    } else {
      setPoints(nextPoints)
    }
  }

  async function save() {
    if (!template) return
    try {
      let saved
      if (template.id) {
        saved = await api.saveTemplate(template.id, template)
      } else {
        saved = await api.createTemplate({ name: template.name, pages: template.pages })
        setTemplate(saved)
      }
      setTemplates(await api.templates())
      setStatus('Saved.')
      if (onTemplateSelect && saved?.id) onTemplateSelect(saved.id)
    } catch (err) {
      setStatus('Save failed: ' + err.message)
    }
  }

  async function deleteTemplate() {
    if (!template?.id) { setTemplate(null); return }
    if (!window.confirm(`Delete template "${template.name}"?`)) return
    await api.deleteTemplate(template.id)
    setTemplates(await api.templates())
    setTemplate(null)
  }

  return (
    <div className="builder">
      <div className="panel">
        <h3>Create Template</h3>
        <p className="muted">Name a new template, start from a blank A4 page (or duplicate one below), draw lines/sections, configure each one, add pages, and Save. Create as many as you like — every saved template appears in the top-bar Template dropdown.</p>
        <button onClick={newTemplate}>+ New Template</button>
        {templates.map((t) => (
          <div key={t.id} className="list-item" onClick={() => openTemplate(t)}>
            <span>{t.name} <span className="muted">({t.pages?.length || 0} page{(t.pages?.length || 0) === 1 ? '' : 's'})</span></span>
            <button onClick={(e) => { e.stopPropagation(); duplicateTemplate(t) }}>Duplicate</button>
          </div>
        ))}
        {template && (
          <>
            <h3>Template</h3>
            <label>Name — rename here, then Save template <input value={template.name} onChange={(e) => setTemplate({ ...template, name: e.target.value })} /></label>
            <div className="row">
              <button onClick={save}>Save template</button>
              <button onClick={deleteTemplate} className="danger">Delete</button>
            </div>
            <div className="row">
              <button onClick={() => { setTemplate({ ...template, pages: [...template.pages, { lines: [], sections: [] }] }) }}>+ Add page</button>
              <button onClick={() => setShowGrid(!showGrid)}>{showGrid ? 'Hide grid' : 'Show grid'}</button>
            </div>
            <div className="row">
              <button className={mode === 'line' ? 'active' : ''} onClick={() => { setMode('line'); setPoints([]) }}>Line (2 points)</button>
              <button className={mode === 'section' ? 'active' : ''} onClick={() => { setMode('section'); setPoints([]) }}>Section (4 points)</button>
            </div>
            <p className="muted">Click grid intersections on the A4 page. {mode === 'line' ? '2 points make a black line.' : '4 points make a rectangle section.'} {points.length > 0 && `${points.length} point${points.length > 1 ? 's' : ''} placed — click to cancel.`}</p>
            {points.length > 0 && <button onClick={() => setPoints([])}>Cancel points</button>}
            {status && <p>{status}</p>}
            <div className="row">
              {template.pages.map((_, i) => (
                <button key={i} className={i === pageIdx ? 'active' : ''} onClick={() => { setPageIdx(i); setPoints([]); setSelected(null) }}>Page {i + 1}</button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="board-area">
        {!template && <p>Select a template on the left, or create a new one.</p>}
        {template && page && (
          <div
            className="a4"
            style={{
              width: 210 * SCALE, height: 297 * SCALE,
              backgroundImage: showGrid ? 'linear-gradient(#ddd 1px, transparent 1px), linear-gradient(90deg, #ddd 1px, transparent 1px)' : 'none',
              backgroundSize: `${10 * SCALE}px ${10 * SCALE}px`,
            }}
            onClick={onPageClick}
          >
            <svg width={210 * SCALE} height={297 * SCALE} style={{ position: 'absolute', inset: 0 }}>
              {page.lines.map((l) => (
                <g key={l.id}>
                  <line x1={l.x1 * SCALE} y1={l.y1 * SCALE} x2={l.x2 * SCALE} y2={l.y2 * SCALE} stroke={l.color} strokeWidth={l.thickness * SCALE} />
                  <line x1={l.x1 * SCALE} y1={l.y1 * SCALE} x2={l.x2 * SCALE} y2={l.y2 * SCALE} stroke="transparent" strokeWidth={10}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'line', id: l.id }) }} />
                </g>
              ))}
            </svg>
            {page.sections.map((s) => (
              <div
                key={s.id}
                className={'section-box' + (selected?.kind === 'section' && selected.id === s.id ? ' selected' : '')}
                style={{
                  left: s.x * SCALE, top: s.y * SCALE, width: s.width * SCALE, height: s.height * SCALE,
                  fontFamily: s.font, fontSize: s.size * SCALE / 3, color: s.color,
                  fontWeight: s.bold ? 'bold' : 'normal', fontStyle: s.italic ? 'italic' : 'normal',
                  textAlign: s.align,
                }}
                onClick={(e) => { e.stopPropagation(); setSelected({ kind: 'section', id: s.id }) }}
              >
                {s.text || s.goal || 'Section'}
              </div>
            ))}
            {points.map((p, i) => (
              <div key={i} className="point-marker" style={{ left: p.x * SCALE - 5, top: p.y * SCALE - 5 }} />
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Properties</h3>
        {!selectedEl && <p className="muted">Click a line or section on the page to edit it.</p>}
        {selectedEl && selected.kind === 'line' && (
          <>
            <p>Line ({selectedEl.x1},{selectedEl.y1}) → ({selectedEl.x2},{selectedEl.y2}) mm</p>
            <label>Colour <input type="color" value={selectedEl.color} onChange={(e) => updateSelected({ color: e.target.value })} /></label>
            <label>Thickness <input type="number" min="0.5" step="0.5" value={selectedEl.thickness} onChange={(e) => updateSelected({ thickness: parseFloat(e.target.value) || 1 })} /></label>
            <button className="danger" onClick={() => { updatePage((p) => { p.lines = p.lines.filter((l) => l.id !== selected.id) }); setSelected(null) }}>Delete line</button>
          </>
        )}
        {selectedEl && selected.kind === 'section' && (
          <>
            <p>Section {selectedEl.width} × {selectedEl.height} mm at ({selectedEl.x}, {selectedEl.y})</p>
            <label>Type
              <select value={selectedEl.type} onChange={(e) => updateSelected({ type: e.target.value })}>
                <option value="paragraph">Paragraph</option>
                <option value="bullets">Bullets</option>
              </select>
            </label>
            <label>Font
              <select value={selectedEl.font} onChange={(e) => updateSelected({ font: e.target.value })}>
                {FONTS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </label>
            <label>Font size <input type="number" min="6" max="48" value={selectedEl.size} onChange={(e) => updateSelected({ size: parseFloat(e.target.value) || 11 })} /></label>
            <label>Font colour <input type="color" value={selectedEl.color} onChange={(e) => updateSelected({ color: e.target.value })} /></label>
            <label><input type="checkbox" checked={selectedEl.bold} onChange={(e) => updateSelected({ bold: e.target.checked })} /> Bold</label>
            <label><input type="checkbox" checked={selectedEl.italic} onChange={(e) => updateSelected({ italic: e.target.checked })} /> Italic</label>
            <label>Alignment
              <select value={selectedEl.align} onChange={(e) => updateSelected({ align: e.target.value })}>
                <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
              </select>
            </label>
            <label>Goal / description
              <textarea rows={4} value={selectedEl.goal} placeholder="What should this section contain?" onChange={(e) => updateSelected({ goal: e.target.value })} />
            </label>
            <button className="danger" onClick={() => { updatePage((p) => { p.sections = p.sections.filter((s) => s.id !== selected.id) }); setSelected(null) }}>Delete section</button>
          </>
        )}
      </div>
    </div>
  )
}
