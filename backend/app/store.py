"""JSON file storage under backend/data/ (gitignored).

templates/  -> one JSON file per template  (<id>.json)
profiles/   -> one .txt file per profile   (<id>.txt, name = first line / filename)
settings.json -> {"model": ..., "api_keys": {provider: key}}
"""
import json
import os
import re
import uuid

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
TEMPLATES_DIR = os.path.join(DATA_DIR, "templates")
PROFILES_DIR = os.path.join(DATA_DIR, "profiles")
SETTINGS_PATH = os.path.join(DATA_DIR, "settings.json")


def ensure_dirs():
    os.makedirs(TEMPLATES_DIR, exist_ok=True)
    os.makedirs(PROFILES_DIR, exist_ok=True)


def slugify(name):
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", name.strip().lower()).strip("-")
    return slug or uuid.uuid4().hex[:8]


# ---- templates ----
def list_templates():
    ensure_dirs()
    out = []
    for fn in sorted(os.listdir(TEMPLATES_DIR)):
        if fn.endswith(".json"):
            try:
                with open(os.path.join(TEMPLATES_DIR, fn)) as f:
                    out.append(json.load(f))
            except Exception:
                continue
    return out


def get_template(template_id):
    path = os.path.join(TEMPLATES_DIR, f"{template_id}.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def save_template(data):
    ensure_dirs()
    if not data.get("id"):
        data["id"] = slugify(data.get("name", "template")) + "-" + uuid.uuid4().hex[:6]
    path = os.path.join(TEMPLATES_DIR, f"{data['id']}.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    return data


def delete_template(template_id):
    path = os.path.join(TEMPLATES_DIR, f"{template_id}.json")
    if os.path.exists(path):
        os.remove(path)
        return True
    return False


# ---- profiles ----
def list_profiles():
    ensure_dirs()
    out = []
    for fn in sorted(os.listdir(PROFILES_DIR)):
        if fn.endswith(".txt"):
            pid = fn[:-4]
            with open(os.path.join(PROFILES_DIR, fn), encoding="utf-8", errors="ignore") as f:
                content = f.read()
            name = content.splitlines()[0].strip() if content.strip() else pid
            out.append({"id": pid, "name": name, "filename": fn})
    return out


def get_profile(profile_id):
    path = os.path.join(PROFILES_DIR, f"{profile_id}.txt")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8", errors="ignore") as f:
        content = f.read()
    name = content.splitlines()[0].strip() if content.strip() else profile_id
    return {"id": profile_id, "name": name, "content": content}


def save_profile(name, content):
    ensure_dirs()
    pid = slugify(name) + "-" + uuid.uuid4().hex[:6]
    path = os.path.join(PROFILES_DIR, f"{pid}.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return {"id": pid, "name": name, "content": content}


def delete_profile(profile_id):
    path = os.path.join(PROFILES_DIR, f"{profile_id}.txt")
    if os.path.exists(path):
        os.remove(path)
        return True
    return False


# ---- settings ----
def get_settings():
    ensure_dirs()
    if not os.path.exists(SETTINGS_PATH):
        return {"model": "xai/grok-4", "api_keys": {}}
    try:
        with open(SETTINGS_PATH) as f:
            data = json.load(f)
        data.setdefault("model", "xai/grok-4")
        data.setdefault("api_keys", {})
        return data
    except Exception:
        return {"model": "xai/grok-4", "api_keys": {}}


def save_settings(data):
    ensure_dirs()
    current = get_settings()
    merged = {
        "model": data.get("model", current.get("model", "xai/grok-4")),
        "api_keys": {**current.get("api_keys", {}), **data.get("api_keys", {})},
    }
    # Drop empty keys (clearing a key)
    merged["api_keys"] = {k: v for k, v in merged["api_keys"].items() if v}
    with open(SETTINGS_PATH, "w") as f:
        json.dump(merged, f, indent=2)
    return merged


def seed_if_empty():
    """Create one example template + one example profile on first run."""
    ensure_dirs()
    if not list_templates():
        example = {
            "id": "example-template",
            "name": "Example — One Page",
            "pages": [
                {
                    "lines": [
                        {"id": "line-1", "x1": 10, "y1": 55, "x2": 200, "y2": 55, "color": "#000000", "thickness": 1},
                        {"id": "line-2", "x1": 10, "y1": 145, "x2": 200, "y2": 145, "color": "#000000", "thickness": 1},
                    ],
                    "sections": [
                        {"id": "sec-name", "x": 10, "y": 10, "width": 190, "height": 15, "type": "paragraph", "font": "Arial", "size": 22, "color": "#000000", "bold": True, "italic": False, "align": "left", "goal": "Candidate full name as a heading — just the name, nothing else."},
                        {"id": "sec-summary", "x": 10, "y": 28, "width": 190, "height": 25, "type": "paragraph", "font": "Arial", "size": 11, "color": "#222222", "bold": False, "italic": False, "align": "left", "goal": "Professional summary, 2-3 lines, tailored to the job description, using the strongest points from the profile."},
                        {"id": "sec-experience", "x": 10, "y": 60, "width": 190, "height": 80, "type": "bullets", "font": "Arial", "size": 11, "color": "#000000", "bold": False, "italic": False, "align": "left", "goal": "Experience bullet points, 4-6 bullets, one line each, achievements with numbers where the profile has them, tailored to the job description."},
                        {"id": "sec-skills", "x": 10, "y": 150, "width": 190, "height": 30, "type": "paragraph", "font": "Arial", "size": 11, "color": "#000000", "bold": False, "italic": False, "align": "left", "goal": "Skills list, comma-separated, most relevant to the job description first."},
                    ],
                }
            ],
        }
        save_template(example)
    if not list_profiles():
        profile = (
            "Alex Morgan\n"
            "Software Engineer — alex.morgan@example.com — +1 555 010 1234\n"
            "\n"
            "Summary: Software engineer with 5 years of experience building web applications and APIs in Python and React. Led a team of 4 engineers, shipped features used by 20,000 users.\n"
            "\n"
            "Experience:\n"
            "- Senior Software Engineer, Acme Corp, 2022-2026: Built a FastAPI billing service processing $2M per month; cut API latency by 40%.\n"
            "- Software Engineer, Beta Ltd, 2020-2022: Built a React dashboard used by 500 internal users; automated reporting, saving 10 hours per week.\n"
            "\n"
            "Skills: Python, FastAPI, React, PostgreSQL, Docker, AWS, Kubernetes, Git.\n"
            "\n"
            "Education: BSc Computer Science, State University, 2020.\n"
        )
        path = os.path.join(PROFILES_DIR, "example-profile.txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write(profile)
