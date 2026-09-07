"""
reports_service.py
--------------------
Builds a professional PDF screening report (patient details, prediction
result, probability gauge, AI health suggestions, QR code, disclaimer).

Purely additive — used only by the new report routes. Does not touch the
existing lightweight /api/history/export?format=pdf table export in app.py.
"""

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.graphics.shapes import Drawing, Wedge, String, Circle
from reportlab.graphics import renderPDF

NAVY = colors.HexColor("#0f1b2d")
TEAL = colors.HexColor("#0e7c86")
TEAL_DARK = colors.HexColor("#0a5d65")
CORAL = colors.HexColor("#d9534f")
LIGHT = colors.HexColor("#f6f8fa")
LINE = colors.HexColor("#e3e8ee")
SURFACE = colors.HexColor("#f0f4f8")


def _gauge_drawing(probability, result):
    """Small semicircular risk gauge rendered as a reportlab Drawing."""
    d = Drawing(160, 100)
    cx, cy, r = 80, 15, 65
    color = CORAL if result == "Positive" else TEAL
    # background arc
    d.add(Wedge(cx, cy, r, 0, 180, fillColor=LIGHT, strokeColor=None))
    # value arc
    pct = max(0, min(100, probability or 0))
    angle = 180 * (pct / 100)
    d.add(Wedge(cx, cy, r, 180 - angle, 180, fillColor=color, strokeColor=None))
    d.add(Circle(cx, cy, r - 22, fillColor=colors.white, strokeColor=None))
    d.add(String(cx, cy + 6, f"{pct:.0f}%", textAnchor="middle",
                  fontName="Helvetica-Bold", fontSize=18, fillColor=NAVY))
    d.add(String(cx, cy - 10, "risk score", textAnchor="middle",
                  fontName="Helvetica", fontSize=8, fillColor=colors.HexColor("#6c7d97")))
    return d


def _qr_image(data_str, size=90):
    try:
        import qrcode
    except ImportError:
        return None
    qr = qrcode.QRCode(box_size=4, border=1)
    qr.add_data(data_str)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0f1b2d", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return Image(buf, width=size, height=size)


def build_report_pdf(record, suggestions, patient_name=None, verify_url=None):
    """
    record: dict shape from PredictionHistory.to_api_dict()
    suggestions: dict shape from Suggestion.to_dict() (or None)
    Returns: BytesIO containing the PDF.
    """
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("H1c", parent=styles["Heading1"], textColor=NAVY, fontSize=18, spaceAfter=2))
    styles.add(ParagraphStyle("Sub", parent=styles["Normal"], textColor=colors.HexColor("#6c7d97"), fontSize=9))
    styles.add(ParagraphStyle("Section", parent=styles["Heading2"], textColor=TEAL_DARK, fontSize=12, spaceBefore=14, spaceAfter=6))
    styles.add(ParagraphStyle("Body", parent=styles["Normal"], fontSize=9.5, leading=14))
    styles.add(ParagraphStyle("Small", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#6c7d97")))

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=20 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm,
    )
    elements = []

    # --- Header ---
    is_positive = record["result"] == "Positive"
    elements.append(Paragraph("GlucoseCheck — Diabetes Screening Report", styles["H1c"]))
    elements.append(Paragraph(
        f"Report #{record['id'][:8].upper()} &middot; Generated {datetime.utcnow().strftime('%d %b %Y, %H:%M UTC')}",
        styles["Sub"],
    ))
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", color=LINE, thickness=1))
    elements.append(Spacer(1, 12))

    # --- Patient details + result badge ---
    inp = record["input"]
    bmi_val = float(inp.get("bmi", 25.0) or 25.0)
    gender_str = str(inp.get("gender", "Male")).capitalize()
    height_cm = float(inp.get("height", 170.0 if gender_str == "Male" else 160.0) or (170.0 if gender_str == "Male" else 160.0))
    weight_kg = float(inp.get("weight", round(bmi_val * ((height_cm / 100.0) ** 2), 1)) or round(bmi_val * ((height_cm / 100.0) ** 2), 1))

    prob_pct = float(record.get("probability", 0) or 0)
    conf_score = f"{max(prob_pct, 100 - prob_pct):.1f}%"

    patient_table_data = [
        ["Patient Name", patient_name or "—", "Result", record["result"]],
        ["Age", str(inp["age"]), "Gender", gender_str],
        ["Height", f"{height_cm:.0f} cm", "Weight", f"{weight_kg:.1f} kg"],
        ["BMI", f"{bmi_val:.1f}", "Risk Score", f"{prob_pct:.1f}%"],
        ["Confidence Score", conf_score, "HbA1c Level", f"{inp['HbA1c_level']}%"],
        ["Blood Glucose", f"{inp['blood_glucose_level']} mg/dL", "Hypertension", str(inp["hypertension"])],
        ["Heart Disease", str(inp["heart_disease"]), "Smoking History", str(inp["smoking_history"])],
    ]
    pt = Table(patient_table_data, colWidths=[90, 125, 90, 125])
    pt.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#6c7d97")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#6c7d97")),
        ("FONTNAME", (1, 0), (1, 0), "Helvetica-Bold"),
        ("TEXTCOLOR", (1, 0), (1, 0), CORAL if is_positive else TEAL_DARK),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
    ]))

    gauge = _gauge_drawing(prob_pct, record["result"])
    right_col = [gauge]
    header_row = Table([[pt, right_col]], colWidths=[430, 160])
    header_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(header_row)

    # --- AI Suggestions ---
    if suggestions:
        elements.append(Paragraph("AI Health Summary & Risk Explanation", styles["Section"]))
        elements.append(Paragraph(suggestions.get("risk_analysis") or "—", styles["Body"]))

        def bullet_block(title, items):
            elements.append(Paragraph(title, styles["Section"]))
            if isinstance(items, list):
                for it in items:
                    elements.append(Paragraph(f"• {it}", styles["Body"]))
            elif items:
                elements.append(Paragraph(str(items), styles["Body"]))

        bullet_block("Personalized Suggestions & Lifestyle Advice", suggestions.get("lifestyle"))
        bullet_block("Food Suggestions", suggestions.get("food"))
        bullet_block("Exercise Recommendations", suggestions.get("exercise"))

        wellness_data = [
            ["Water Intake Recommendation", suggestions.get("water_intake") or "—"],
            ["Sleep Recommendation", suggestions.get("sleep") or "—"],
            ["Next Recommended Checkup", suggestions.get("next_checkup") or "—"],
        ]
        wt = Table(wellness_data, colWidths=[160, 315])
        wt.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, 0), (0, -1), TEAL_DARK),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ]))
        elements.append(Spacer(1, 6))
        elements.append(wt)

        bullet_block("Stress Management Tips", suggestions.get("stress_management"))

    # --- Calorie Calc & Macronutrients Section ---
    age = float(inp.get("age", 40) or 40)
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (5 if gender_str == "Male" else -161)
    maint = int(round(bmr * 1.45))
    protein_g = int(round(maint * 0.25 / 4))
    carbs_g = int(round(maint * 0.50 / 4))
    fat_g = int(round(maint * 0.25 / 9))
    rec_water_l = round(weight_kg * 35 / 1000, 1)

    elements.append(Spacer(1, 10))
    elements.append(Paragraph("Calorie & Macronutrient Summary", styles["Section"]))
    cal_table_data = [
        ["Daily Maintenance Calories", f"{maint} kcal/day", "Daily Protein Target", f"{protein_g} g / day"],
        ["Weight Loss Target", f"{max(1200, maint-450)} kcal/day", "Daily Carbohydrates Target", f"{carbs_g} g / day"],
        ["Weight Gain Target", f"{maint+450} kcal/day", "Daily Fat Target", f"{fat_g} g / day"],
        ["Water Intake Recommendation", f"{rec_water_l} Liters / day (10 glasses)", "Daily Fiber Target", "25 - 30 g / day"],
    ]
    ct = Table(cal_table_data, colWidths=[135, 100, 140, 100])
    ct.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(ct)

    elements.append(Spacer(1, 10))
    elements.append(Paragraph("AI Diet Plan (Sample 1-Day Meal Plan)", styles["Section"]))
    meal_table_data = [
        ["Meal", "Recommended Food Item", "Calories", "Key Nutrition Benefits"],
        ["Breakfast", "Oatmeal porridge with chia seeds & cinnamon", "320 kcal", "High soluble fiber to stabilize blood glucose spikes"],
        ["Snacks (Mid-Morning)", "Handful of raw almonds & walnuts + green tea", "150 kcal", "Rich in healthy omega-3 fatty acids and antioxidants"],
        ["Lunch", "Brown rice with lentils (dal) & spinach salad", "480 kcal", "Lean protein and complex carbs for sustained energy"],
        ["Snacks (Evening)", "Roasted chickpeas (chana) with cucumber", "140 kcal", "Low glycemic index snack rich in dietary fiber"],
        ["Dinner", "Tofu / Salmon sautéed with cauliflower rice", "380 kcal", "Light, low-carb dinner promoting nighttime glucose control"],
    ]
    mt = Table(meal_table_data, colWidths=[90, 175, 65, 145])
    mt.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (-1, 0), SURFACE),
        ("TEXTCOLOR", (0, 0), (-1, 0), TEAL_DARK),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(mt)

    # --- Footer: disclaimer + QR ---
    elements.append(Spacer(1, 12))
    elements.append(HRFlowable(width="100%", color=LINE, thickness=1))
    elements.append(Spacer(1, 10))

    disclaimer_text = (suggestions or {}).get("disclaimer") or (
        "This report is generated by an AI-assisted statistical model and is not a "
        "medical diagnosis. Please consult a licensed physician for clinical evaluation."
    )
    qr_img = _qr_image(verify_url or f"report:{record['id']}") if verify_url or record.get("id") else None

    disclaimer_para = Paragraph(f"<b>Disclaimer:</b> {disclaimer_text}", styles["Small"])
    if qr_img:
        footer_table = Table([[disclaimer_para, qr_img]], colWidths=[430, 90])
        footer_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
        elements.append(footer_table)
    else:
        elements.append(disclaimer_para)

    doc.build(elements)
    buf.seek(0)
    return buf
