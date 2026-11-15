"""Pydantic models for the AI Resume Builder."""
from typing import List, Optional
from pydantic import BaseModel, Field


class Line(BaseModel):
    id: str
    x1: float
    y1: float
    x2: float
    y2: float
    color: str = "#000000"
    thickness: float = 1.0


class Section(BaseModel):
    id: str
    x: float
    y: float
    width: float
    height: float
    type: str = "paragraph"  # paragraph | bullets
    font: str = "Arial"
    size: float = 11.0
    color: str = "#000000"
    bold: bool = False
    italic: bool = False
    align: str = "left"  # left | center | right
    goal: str = ""
    text: str = ""  # filled text (empty in a template, set by /generate)


class Page(BaseModel):
    lines: List[Line] = Field(default_factory=list)
    sections: List[Section] = Field(default_factory=list)


class Template(BaseModel):
    id: str
    name: str
    pages: List[Page] = Field(default_factory=list)


class TemplateCreate(BaseModel):
    name: str = "Untitled template"
    pages: List[Page] = Field(default_factory=list)


class ProfileCreate(BaseModel):
    name: str
    content: str


class GenerateRequest(BaseModel):
    template_id: str
    profile_id: str
    job_description: str = ""
    model: Optional[str] = None


class SectionResult(BaseModel):
    section_id: str
    text: str


class GenerateResponse(BaseModel):
    filled_template: Template
    fallback: bool
    model: str
    sections: List[SectionResult]


class ExportRequest(BaseModel):
    filled_template: Template


# Model catalogue — LiteLLM model ids. Grok is the default.
MODELS = [
    {"id": "xai/grok-4", "label": "Grok 4 (xAI)", "provider": "xai"},
    {"id": "xai/grok-3", "label": "Grok 3 (xAI)", "provider": "xai"},
    {"id": "openai/gpt-5", "label": "GPT-5 (OpenAI)", "provider": "openai"},
    {"id": "openai/gpt-4o", "label": "GPT-4o (OpenAI)", "provider": "openai"},
    {"id": "anthropic/claude-sonnet-4-5-20250929", "label": "Claude Sonnet 4.5 (Anthropic)", "provider": "anthropic"},
    {"id": "anthropic/claude-opus-4-1-20250805", "label": "Claude Opus 4.1 (Anthropic)", "provider": "anthropic"},
    {"id": "gemini/gemini-2.5-pro", "label": "Gemini 2.5 Pro (Google)", "provider": "google"},
    {"id": "deepseek/deepseek-chat", "label": "DeepSeek Chat", "provider": "deepseek"},
    {"id": "meta-llama/llama-3.3-70b-instruct", "label": "Llama 3.3 70B (Meta)", "provider": "meta-llama"},
]

PROVIDERS = [
    {"id": "xai", "label": "xAI (Grok)"},
    {"id": "openai", "label": "OpenAI (GPT)"},
    {"id": "anthropic", "label": "Anthropic (Claude)"},
    {"id": "google", "label": "Google (Gemini)"},
    {"id": "deepseek", "label": "DeepSeek"},
    {"id": "meta-llama", "label": "Meta (Llama)"},
]

DEFAULT_MODEL = "xai/grok-4"
