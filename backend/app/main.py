"""FastAPI backend for the AI Resume Builder."""
import os
import uuid

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from . import store
from .agent import generate_resume
from .models import (
    DEFAULT_MODEL,
    MODELS,
    PROVIDERS,
    ExportRequest,
    GenerateRequest,
    GenerateResponse,
    ProfileCreate,
    Template,
    TemplateCreate,
)
from .pdf import render_pdf

app = FastAPI(title="AI Resume Builder")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    store.seed_if_empty()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/models")
def models():
    return MODELS


@app.get("/api/providers")
def providers():
    return PROVIDERS


# ---- settings / API keys ----
@app.get("/api/settings")
def get_settings():
    s = store.get_settings()
    return {
        "model": s.get("model", DEFAULT_MODEL),
        "providers_with_key": sorted(s.get("api_keys", {}).keys()),
    }


@app.get("/api/settings/api-keys")
def get_api_keys():
    s = store.get_settings()
    return {"providers_with_key": sorted(s.get("api_keys", {}).keys())}


@app.post("/api/settings/api-keys")
def save_api_keys(payload: dict):
    # Accepts {"model": ..., "api_keys": {provider: key}}; never returns key values.
    merged = store.save_settings(payload)
    return {
        "model": merged.get("model", DEFAULT_MODEL),
        "providers_with_key": sorted(merged.get("api_keys", {}).keys()),
    }


# ---- templates ----
@app.get("/api/templates")
def list_templates():
    return store.list_templates()


@app.post("/api/templates")
def create_template(payload: TemplateCreate):
    data = {"id": uuid.uuid4().hex[:8], "name": payload.name, "pages": [p.model_dump() for p in payload.pages]}
    return store.save_template(data)


@app.get("/api/templates/{template_id}")
def get_template(template_id: str):
    t = store.get_template(template_id)
    if not t:
        raise HTTPException(404, "template not found")
    return t


@app.put("/api/templates/{template_id}")
def update_template(template_id: str, payload: Template):
    data = payload.model_dump()
    data["id"] = template_id
    return store.save_template(data)


@app.delete("/api/templates/{template_id}")
def delete_template(template_id: str):
    if not store.delete_template(template_id):
        raise HTTPException(404, "template not found")
    return {"deleted": template_id}


# ---- profiles ----
@app.get("/api/profiles")
def list_profiles():
    return store.list_profiles()


@app.post("/api/profiles")
async def upload_profile(file: UploadFile = File(...)):
    content = (await file.read()).decode("utf-8", errors="ignore")
    name = os.path.splitext(file.filename or "profile")[0]
    return store.save_profile(name, content)


@app.post("/api/profiles/text")
def create_profile_text(payload: ProfileCreate):
    return store.save_profile(payload.name, payload.content)


@app.get("/api/profiles/{profile_id}")
def get_profile(profile_id: str):
    p = store.get_profile(profile_id)
    if not p:
        raise HTTPException(404, "profile not found")
    return p


@app.delete("/api/profiles/{profile_id}")
def delete_profile(profile_id: str):
    if not store.delete_profile(profile_id):
        raise HTTPException(404, "profile not found")
    return {"deleted": profile_id}


# ---- generate ----
@app.post("/api/generate", response_model=GenerateResponse)
def generate(payload: GenerateRequest):
    template = store.get_template(payload.template_id)
    if not template:
        raise HTTPException(404, "template not found")
    profile = store.get_profile(payload.profile_id)
    if not profile:
        raise HTTPException(404, "profile not found")
    settings = store.get_settings()
    model_id = payload.model or settings.get("model") or DEFAULT_MODEL
    provider = next((m["provider"] for m in MODELS if m["id"] == model_id), "xai")
    api_key = settings.get("api_keys", {}).get(provider)
    filled, results, fallback = generate_resume(
        template, profile["content"], payload.job_description, model_id, api_key
    )
    return {"filled_template": filled, "fallback": fallback, "model": model_id, "sections": results}


@app.post("/api/export-pdf")
def export_pdf(payload: ExportRequest):
    pdf_bytes = render_pdf(payload.filled_template.model_dump())
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="resume.pdf"'},
    )
