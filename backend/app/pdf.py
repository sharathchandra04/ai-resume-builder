"""Render a filled template to an A4 PDF with ReportLab.

Uses the same mm coordinates as the frontend preview, so the PDF
matches the preview: origin top-left in the template, bottom-left in
ReportLab, converted with mm -> points.
"""
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Frame
from reportlab.pdfgen import canvas

MM_TO_PT = 72.0 / 25.4
PAGE_W, PAGE_H = A4  # 595.27 x 841.89 pt = 210 x 297 mm


def _font_name(font, bold, italic):
    f = (font or "Arial").lower()
    if "times" in f or "serif" in f:
        if bold and italic:
            return "Times-BoldItalic"
        if bold:
            return "Times-Bold"
        if italic:
            return "Times-Italic"
        return "Times-Roman"
    if bold and italic:
        return "Helvetica-BoldOblique"
    if bold:
        return "Helvetica-Bold"
    if italic:
        return "Helvetica-Oblique"
    return "Helvetica"


def _hex(color):
    try:
        return HexColor(color or "#000000")
    except Exception:
        return HexColor("#000000")


def render_pdf(filled_template):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    for page in filled_template.get("pages", []):
        # Lines first (black divider lines).
        for line in page.get("lines", []):
            c.setStrokeColor(_hex(line.get("color", "#000000")))
            c.setLineWidth(float(line.get("thickness") or 1))
            x1 = line["x1"] * MM_TO_PT
            y1 = PAGE_H - line["y1"] * MM_TO_PT
            x2 = line["x2"] * MM_TO_PT
            y2 = PAGE_H - line["y2"] * MM_TO_PT
            c.line(x1, y1, x2, y2)
        # Sections.
        for section in page.get("sections", []):
            text = (section.get("text") or "").strip()
            if not text:
                continue
            size = float(section.get("size") or 11)
            align = {"left": TA_LEFT, "center": TA_CENTER, "right": TA_RIGHT}.get(
                section.get("align") or "left", TA_LEFT
            )
            style = ParagraphStyle(
                "sec",
                fontName=_font_name(section.get("font"), section.get("bold"), section.get("italic")),
                fontSize=size,
                leading=size * 1.3,
                textColor=_hex(section.get("color", "#000000")),
                alignment=align,
            )
            x = section["x"] * MM_TO_PT
            y_top = section["y"] * MM_TO_PT
            w = section["width"] * MM_TO_PT
            h = section["height"] * MM_TO_PT
            frame = Frame(x, PAGE_H - y_top - h, w, h, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
            if section.get("type") == "bullets":
                story = []
                for ln in text.splitlines():
                    ln = ln.strip().lstrip("-• ").strip()
                    if ln:
                        story.append(Paragraph(f"-&nbsp;&nbsp;{ln}", style))
                if story:
                    frame.addFromList(story, c)
            else:
                # Keep line breaks as separate paragraphs.
                story = [Paragraph(p, style) for p in text.splitlines() if p.strip()]
                if story:
                    frame.addFromList(story, c)
        c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()
