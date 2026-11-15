"""Custom agentic loop — NOT LangChain.

Loop, per section, in page order:
  1. calculate_budget(section)  -> max lines / max words from the
     section's width, height, font size and line height.
  2. build_prompt(...)           -> goal + budget + profile + job
     description + text already written for earlier sections.
  3. generate_section(...)      -> one LiteLLM call (thin model client
     only), then a size-fit check. If it overflows, retry once with
     a shorter instruction.
  4. If no API key is set for the chosen model, or the model call
     fails, fall back to a deterministic extractive filler built
     from the profile text, and mark the whole response fallback=True,
     so generation still works offline for testing.
"""
import math
import re

try:
    from reportlab.pdfbase.pdfmetrics import stringWidth
    from reportlab.lib.fonts import tt2ps
except Exception:  # pragma: no cover
    stringWidth = None

MM_TO_PT = 72.0 / 25.4


def _font_name(font, bold, italic):
    f = (font or "Arial").lower()
    if "times" in f or "serif" in f:
        base = "Times-Roman"
        if bold and italic:
            return "Times-BoldItalic"
        if bold:
            return "Times-Bold"
        if italic:
            return "Times-Italic"
        return base
    # Helvetica family covers Arial / sans-serif
    if bold and italic:
        return "Helvetica-BoldOblique"
    if bold:
        return "Helvetica-Bold"
    if italic:
        return "Helvetica-Oblique"
    return "Helvetica"


def estimate_lines(text, section):
    """Estimate how many rendered lines `text` takes in this section."""
    width_pt = section["width"] * MM_TO_PT
    font_name = _font_name(section.get("font"), section.get("bold"), section.get("italic"))
    size = float(section.get("size") or 11)
    lines = 0
    for raw in (text or "").splitlines() or [""]:
        line = raw.strip()
        if section.get("type") == "bullets":
            line = "•  " + line
        if not line:
            lines += 1
            continue
        if stringWidth is not None:
            try:
                w = stringWidth(line, font_name, size)
            except Exception:
                w = len(line) * size * 0.5
        else:
            w = len(line) * size * 0.5
        lines += max(1, math.ceil(w / max(width_pt, 10)))
    return lines


def calculate_budget(section):
    """Max lines / max words that fit in the section."""
    height_pt = section["height"] * MM_TO_PT
    size = float(section.get("size") or 11)
    line_height = size * 1.3
    max_lines = max(1, int(height_pt // line_height))
    width_pt = section["width"] * MM_TO_PT
    # Average character width ~0.5 * font size; average word ~5.5 chars.
    chars_per_line = max(10, int(width_pt / max(size * 0.5, 1)))
    max_words = max(5, int(chars_per_line * max_lines / 5.5))
    return {"max_lines": max_lines, "max_words": max_words}


def build_prompt(section, budget, profile_text, job_description, previous):
    prev = ""
    if previous:
        prev = "\nAlready written in earlier sections (do not repeat this):\n" + "\n".join(
            f"- {p['section_id']}: {p['text']}" for p in previous
        )
    kind = "bullet points, one bullet per line, no bullet character needed" if section.get("type") == "bullets" else "plain paragraph text"
    return (
        "You are writing one section of a resume. Write only the section text, no headings, no commentary.\n\n"
        f"Section goal: {section.get('goal') or 'Write relevant resume text.'}\n"
        f"Format: {kind}. Maximum {budget['max_lines']} lines and about {budget['max_words']} words — it must fit in the space.\n\n"
        f"Job description:\n{job_description or '(none provided)'}\n\n"
        f"Candidate profile:\n{profile_text}\n"
        f"{prev}\n"
        "Section text:"
    )


def _fallback_text(section, budget, profile_text):
    """Deterministic extractive filler from the profile text."""
    lines = [ln.strip() for ln in (profile_text or "").splitlines() if ln.strip()]
    if not lines:
        return ""
    goal = (section.get("goal") or "").lower()
    # Name heading: first line of the profile.
    if "name" in goal and "heading" in goal:
        return lines[0]
    # Skills list: the profile line starting "Skills:".
    if "skill" in goal:
        for ln in lines:
            if ln.lower().startswith("skills:"):
                return ln.split(":", 1)[1].strip()
    # Summary: the profile line starting "Summary:".
    if "summary" in goal:
        for ln in lines:
            if ln.lower().startswith("summary:"):
                text = ln.split(":", 1)[1].strip()
                words = text.split()
                return " ".join(words[: budget["max_words"]])
    if section.get("type") == "bullets":
        bullets = [ln.lstrip("-• ").strip() for ln in lines if ln.startswith(("-", "•"))]
        if not bullets:
            bullets = lines[1:]
        picked = []
        for b in bullets:
            words = b.split()
            if len(words) > 20:
                b = " ".join(words[:20])
            picked.append(b)
            if len(picked) >= budget["max_lines"]:
                break
        return "\n".join(picked) if picked else lines[0]
    # Paragraph: take sentences / lines until the word budget is met.
    words = []
    for ln in lines:
        for w in ln.split():
            words.append(w)
            if len(words) >= budget["max_words"]:
                return " ".join(words)
    return " ".join(words)


def _call_model(model_id, api_key, prompt):
    import litellm

    resp = litellm.completion(
        model=model_id,
        messages=[{"role": "user", "content": prompt}],
        api_key=api_key or None,
        temperature=0.7,
        max_tokens=800,
    )
    return resp.choices[0].message.content.strip()


def generate_section(section, profile_text, job_description, previous, model_id, api_key):
    budget = calculate_budget(section)
    if not api_key:
        return _fallback_text(section, budget, profile_text), True
    prompt = build_prompt(section, budget, profile_text, job_description, previous)
    try:
        text = _call_model(model_id, api_key, prompt)
    except Exception:
        return _fallback_text(section, budget, profile_text), True
    # Size-fit check: retry once, shorter, if it overflows.
    if estimate_lines(text, section) > budget["max_lines"]:
        try:
            shorter = _call_model(
                model_id,
                api_key,
                prompt + f"\n\nThat was too long. Rewrite it in at most {max(1, budget['max_lines'] - 1)} lines and {max(5, budget['max_words'] // 2)} words.",
            )
            if estimate_lines(shorter, section) <= budget["max_lines"]:
                text = shorter
            else:
                text = _fallback_text(section, budget, profile_text)
        except Exception:
            text = _fallback_text(section, budget, profile_text)
    return text, False


def generate_resume(template, profile_text, job_description, model_id, api_key):
    """Run the custom loop over every section, in order. Returns (filled, fallback)."""
    import copy

    filled = copy.deepcopy(template)
    results = []
    fallback_any = False
    previous = []
    for page in filled.get("pages", []):
        for section in page.get("sections", []):
            text, used_fallback = generate_section(
                section, profile_text, job_description, previous, model_id, api_key
            )
            fallback_any = fallback_any or used_fallback
            section["text"] = text
            results.append({"section_id": section["id"], "text": text})
            previous.append({"section_id": section["id"], "text": text})
    return filled, results, fallback_any
