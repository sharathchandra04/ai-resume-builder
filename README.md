# AI Resume Builder

Draw your resume layout on A4 pages, save it as a template, then let an
agent fill it from your profile and a job description — and export a PDF.

## What it does

- **Top bar (always visible)** — three dropdowns, side by side:
  Template, Profile, Model. Pick these first, then paste the job
  description in the Generate tab, then Generate.
- **Create Template (Builder tab)** — name a new template, start from a
  blank A4 page (or duplicate an existing template), draw lines/sections
  interactively on the 10 mm grid, configure each one, add pages, and
  Save. Create as many templates as you like; open any of them to edit,
  duplicate, rename (edit the name, then Save), or delete. Every saved
  template appears in the top-bar Template dropdown. A template is
  configured once and reused to create many different resumes.
- **Builder drawing** — a list of A4 pages (210 × 297 mm) with a 10 mm grid.
  Click grid intersections to place points: 2 points make a black line,
  4 points make a rectangle section. Sections have no outline. Click a
  line or section to edit it in the side panel.
- **Sections** — font family, size, colour, bold, italic, alignment,
  paragraph or bullets, and a goal/description telling the agent what
  the section should contain.
- **Templates** — as many as you like, each saved as a JSON file on the
  backend (`backend/data/templates/`).
- **Profiles** — plain text files, as many as you like
  (`backend/data/profiles/`). Pick the active one from the top-bar
  Profile dropdown.
- **Create Resume (Generate tab)** — uses the Template + Profile + Model
  from the top bar, paste a job description, Generate, preview, edit the
  generated text, and Download PDF. The agent fills every section in
  order, sized to fit that section.
- **Settings** — model dropdown (kept in sync with the top bar), and an
  **API key** section with one password field per provider (xAI, OpenAI,
  Anthropic, Google, DeepSeek, Meta). Only the selected model's key is
  needed. Keys are stored on the backend in `backend/data/settings.json`
  — never in a template, never committed to Git.
- **PDF** — rendered server-side with ReportLab from the same template
  JSON and mm coordinates as the preview, so the PDF matches the preview.

## The agent (custom loop, not LangChain)

`backend/app/agent.py` runs one section at a time, in order:

1. `calculate_budget` — section width/height + font size + line height
   gives max lines and max words.
2. `build_prompt` — section goal + size budget + profile text + job
   description + text already written for earlier sections (so it does
   not repeat itself).
3. One LiteLLM call (LiteLLM is only a thin unified model client for
   Grok / GPT / Claude / Gemini / DeepSeek / Llama). Then a size-fit
   check — if the text overflows, it retries once, shorter.
4. If no API key is set for the chosen model, or the model call fails,
   it falls back to a deterministic extractive filler built from the
   profile text and marks the response `fallback=true`, so generation
   still works offline for testing.

Default model: Grok 4 (`xai/grok-4`).

## Run on Windows

Prerequisites: Python 3.11+ and Node.js 18+.

Backend (in one terminal):

```bat
cd resume-builder\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend (in another terminal):

```bat
cd resume-builder\frontend
npm install
npm run dev
```

Open http://localhost:5173 — the frontend proxies `/api` to the backend
on port 8000.

Production frontend build:

```bat
cd resume-builder\frontend
npm run build
```

## API

All under `/api`: `GET /api/health`, `GET /api/models`,
`GET/POST /api/settings/api-keys`, `GET/POST /api/templates`,
`GET/PUT/DELETE /api/templates/{id}`, `GET /api/profiles`,
`POST /api/profiles` (multipart .txt upload), `POST /api/profiles/text`,
`DELETE /api/profiles/{id}`, `POST /api/generate`,
`POST /api/export-pdf`.

## Seeded data

On first run the backend creates an example template
(`Example — One Page`: name heading, summary, experience bullets,
skills, 2 divider lines) and an example profile (`Alex Morgan`,
software engineer), so the app works immediately with no setup.
