import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

pdf_path = r'c:\Users\Admin\Documents\college shit\Capstone\Vetlink\vetlink-pwa\VETLINK_SYSTEM_STATUS_AND_ACTION_REPORT.pdf'

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont('Helvetica', 8)
        self.setFillColor(colors.HexColor('#64748b'))
        # Header
        self.drawString(54, 752, 'VetLink Animal Decision Support System — Technical Audit & Action Report')
        self.setStrokeColor(colors.HexColor('#cbd5e1'))
        self.setLineWidth(0.5)
        self.line(54, 746, 558, 746)
        # Footer
        self.line(54, 45, 558, 45)
        self.drawString(54, 32, 'College of Computing Studies • EARIST • Confidential Capstone Report')
        page_str = f'Page {self._pageNumber} of {page_count}'
        self.drawRightString(558, 32, page_str)
        self.restoreState()

doc = SimpleDocTemplate(
    pdf_path,
    pagesize=letter,
    leftMargin=54,
    rightMargin=54,
    topMargin=54,
    bottomMargin=54
)

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'DocTitle',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=18,
    leading=22,
    textColor=colors.HexColor('#0f172a'),
    spaceAfter=4
)

subtitle_style = ParagraphStyle(
    'DocSubTitle',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=10.5,
    leading=14,
    textColor=colors.HexColor('#1e40af'),
    spaceAfter=10
)

meta_style = ParagraphStyle(
    'DocMeta',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=8.5,
    leading=12,
    textColor=colors.HexColor('#334155')
)

h1_style = ParagraphStyle(
    'H1',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=12,
    leading=15,
    textColor=colors.HexColor('#0f172a'),
    spaceBefore=12,
    spaceAfter=6
)

h2_style = ParagraphStyle(
    'H2',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=10,
    leading=13,
    textColor=colors.HexColor('#1e3a8a'),
    spaceBefore=8,
    spaceAfter=4
)

body_style = ParagraphStyle(
    'Body',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=8.5,
    leading=12,
    textColor=colors.HexColor('#1e293b'),
    spaceAfter=5
)

bullet_style = ParagraphStyle(
    'Bullet',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=8.5,
    leading=12,
    textColor=colors.HexColor('#1e293b'),
    leftIndent=12,
    spaceAfter=3
)

story = []

# Title & Metadata
story.append(Paragraph('VetLink Animal Decision Support System', title_style))
story.append(Paragraph('Comprehensive Technical Audit, Readiness Evaluation & Path-to-Defense Action Plan', subtitle_style))

meta_text = (
    '<b>Institution:</b> College of Computing Studies, EARIST &nbsp;|&nbsp; <b>Date:</b> October 23, 2026<br/>'
    '<b>Project:</b> A Deep Learning Animal Decision Support System Using MobileNetV3 and Grad-CAM for VetLink Clinic<br/>'
    '<b>Defense Window:</b> November 9–11, 2026 &nbsp;|&nbsp; <b>Current Codebase Readiness:</b> <font color="#b91c1c"><b>82%</b></font> (Target: 100% by Oct 25)<br/>'
    '<b>Overall Capstone Progress:</b> <font color="#b91c1c"><b>60%</b></font> (Code + Beneficiary Testing + Chapters 1–5 Draft)'
)
story.append(Paragraph(meta_text, meta_style))
story.append(Spacer(1, 8))
story.append(HRFlowable(width='100%', thickness=1.5, color=colors.HexColor('#1e3a8a'), spaceAfter=10))

# 1. Executive Summary
story.append(Paragraph('1. Executive Summary & Objective Status', h1_style))
story.append(Paragraph(
    'This audit establishes an unsparing distinction between <b>software system readiness (82%)</b> and '
    '<b>overall capstone completion (60%)</b>. While the core AI classification engine (11 classes across 4 species) '
    'and clinical safety logic are fully operational, three specific visual and structural flaws must be resolved '
    'before presenting the system to the faculty adviser on October 29.', body_style
))

score_data = [
    [Paragraph('<b>Module / Component</b>', body_style), Paragraph('<b>Readiness</b>', body_style), Paragraph('<b>Status</b>', body_style), Paragraph('<b>Audit Findings & Technical Gaps</b>', body_style)],
    [Paragraph('<b>1. AI Model & WASM Engine</b>', body_style), Paragraph('<b>92%</b>', body_style), Paragraph('<font color="#15803d">SOLID</font>', body_style), Paragraph('11 classes, 4 species, 3.1 MB INT8 TFLite, 38–45ms client-side WASM inference; zero cloud cost.', body_style)],
    [Paragraph('<b>2. CDSS Clinical Intelligence</b>', body_style), Paragraph('<b>92%</b>', body_style), Paragraph('<font color="#15803d">SOLID</font>', body_style), Paragraph('Comorbidity detection (delta &le; 55%), discrete Laplacian blur rejection, Grad-CAM, in-chart override, printable Rx.', body_style)],
    [Paragraph('<b>3. Database & Offline Sync</b>', body_style), Paragraph('<b>82%</b>', body_style), Paragraph('<font color="#b45309">GOOD</font>', body_style), Paragraph('IndexedDB multi-store schema, conflict resolution UI, offline auth; needs canvas downsampling to stop image bloat.', body_style)],
    [Paragraph('<b>4. Frontend UI & Native PWA</b>', body_style), Paragraph('<b>70%</b>', body_style), Paragraph('<font color="#b91c1c">ACTION REQ.</font>', body_style), Paragraph('\"Install PWA\" button has no onClick event handler; home dashboard displays static hardcoded numbers.', body_style)],
    [Paragraph('<b>TOTAL SOFTWARE SYSTEM</b>', body_style), Paragraph('<b>82%</b>', body_style), Paragraph('<font color="#1e40af"><b>SOLID B</b></font>', body_style), Paragraph('<b>Core engine is proven; 3 frontend code fixes needed to achieve 100% production readiness.</b>', body_style)],
]

t_score = Table(score_data, colWidths=[120, 55, 65, 264])
t_score.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
    ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#0f172a')),
    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
    ('TOPPADDING', (0,0), (-1,-1), 3.5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
    ('LEFTPADDING', (0,0), (-1,-1), 5),
    ('RIGHTPADDING', (0,0), (-1,-1), 5),
]))
story.append(t_score)
story.append(Spacer(1, 8))

# 2. Technical Inventory
story.append(Paragraph('2. Technical Inventory: What is Currently Working in the System', h1_style))
story.append(Paragraph('<b>A. Edge Machine Learning & Explainable AI</b>', h2_style))
story.append(Paragraph('• <b>Edge Model (vetlink_model_v2.tflite):</b> MobileNetV3-Large fine-tuned across 11 classes spanning Dogs, Cats, Birds, and Rabbits. Quantized to 3.1 MB INT8, executing client-side in 38–45 ms via browser WebAssembly (WASM).', bullet_style))
story.append(Paragraph('• <b>Mathematical Blur Rejection:</b> Discrete 2D Laplacian convolution kernel (&nabla;<sup>2</sup> f) with variance threshold (&sigma;<sup>2</sup> &lt; 80.0) blocking out-of-focus captures before inference.', bullet_style))
story.append(Paragraph('• <b>Erythema-Weighted Grad-CAM:</b> Physiological Erythema Index (2R &minus; G &minus; B) with border suppression highlighting true lesion boundaries.', bullet_style))

story.append(Paragraph('<b>B. Clinical Decision Support System (CDSS)</b>', h2_style))
story.append(Paragraph('• <b>Calibrated 60% Decision Boundary:</b> Confidence &ge; 60% auto-populates care protocols; &lt; 60% triggers mandatory laboratory scraping/cytology prompts.', bullet_style))
story.append(Paragraph('• <b>Suspected Comorbidity Detection:</b> Detects co-occurring conditions (e.g. Hotspots + Ringworm) when prediction delta &le; 55% or secondary &ge; 20%.', bullet_style))
story.append(Paragraph('• <b>In-Chart Diagnostic Override:</b> Dropdown allowing attending vets to reassign diagnoses, ensuring human clinical governance.', bullet_style))
story.append(Paragraph('• <b>Printable Rx Slip:</b> Print layout (@media print) generating official veterinary prescription slips with doctor signature lines.', bullet_style))
story.append(Paragraph('• <b>Longitudinal Recheck:</b> Dual-column Baseline vs. Recheck comparison modal with 4-stage healing progress scoring.', bullet_style))

story.append(Paragraph('<b>C. Hardware Camera & Persistence</b>', h2_style))
story.append(Paragraph('• <b>Live Camera Viewfinder:</b> Direct device video stream with macro lesion framing overlay and instant camera/gallery toggle.', bullet_style))
story.append(Paragraph('• <b>Offline IndexedDB & Sync:</b> Full local schema with offline demo auth fallback and two-way conflict resolution panel.', bullet_style))

# 3. Critical Deficiencies
story.append(Paragraph('3. The 3 Critical Deficiencies (What Needs Immediate Action)', h1_style))

def_data = [
    [Paragraph('<b>Deficiency / Flaw</b>', body_style), Paragraph('<b>Current Code Defect</b>', body_style), Paragraph('<b>Consequence During Adviser / Panel Demo</b>', body_style), Paragraph('<b>Required Fix</b>', body_style)],
    [
        Paragraph('<font color="#b91c1c"><b>1. Dead Install Button</b></font>', body_style),
        Paragraph('<code>App.jsx:212</code> has no <code>onClick</code> handler.', body_style),
        Paragraph('Adviser clicks \"Install PWA\" and literally nothing happens. System will be criticized as a website rather than a PWA.', body_style),
        Paragraph('Attach <code>beforeinstallprompt</code> event listener to trigger native installation dialog.', body_style)
    ],
    [
        Paragraph('<font color="#b91c1c"><b>2. Hardcoded Dashboard</b></font>', body_style),
        Paragraph('<code>ClinicalAnalysis.jsx</code> has static numbers: 24 Cases, 7 Pending.', body_style),
        Paragraph('When users intake 5 new patients, the home dashboard still says 24. Panels will flag the dashboard as non-functional mock data.', body_style),
        Paragraph('Query real counts dynamically from IndexedDB using <code>getPatients()</code> and <code>getPendingSyncQueue()</code>.', body_style)
    ],
    [
        Paragraph('<font color="#b45309"><b>3. Image Bloat in DB</b></font>', body_style),
        Paragraph('Raw 12MP camera photos (4–8 MB) saved as full base64 strings.', body_style),
        Paragraph('IndexedDB accumulates 100+ MB after 15 consultations, causing mobile browser lag or sync timeouts over clinic Wi-Fi.', body_style),
        Paragraph('Downscale photos via HTML5 canvas to 1024x1024 JPEG (quality 0.82) before storing in IndexedDB.', body_style)
    ],
]

t_def = Table(def_data, colWidths=[95, 110, 160, 139])
t_def.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#fee2e2')),
    ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#991b1b')),
    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#fca5a5')),
    ('TOPPADDING', (0,0), (-1,-1), 3.5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
    ('LEFTPADDING', (0,0), (-1,-1), 5),
    ('RIGHTPADDING', (0,0), (-1,-1), 5),
]))
story.append(t_def)
story.append(Spacer(1, 8))

# 4. Roadmap to Defense
story.append(Paragraph('4. Master Milestone Roadmap to Oral Defense (Oct 24 – Nov 11)', h1_style))

road_data = [
    [Paragraph('<b>Date Window</b>', body_style), Paragraph('<b>Phase & Focus</b>', body_style), Paragraph('<b>Key Deliverables & Action Items</b>', body_style), Paragraph('<b>Progress</b>', body_style)],
    [Paragraph('<b>Oct 24–25</b><br/>(Weekend)', body_style), Paragraph('<b>Weekend Sprint</b><br/>Code Freeze', body_style), Paragraph('• Fix the 3 frontend items (PWA install, dynamic metrics, canvas downsampling).<br/>• Rehearse end-to-end camera intake on mobile device.<br/>• <b>System achieves 100% production readiness.</b>', body_style), Paragraph('<b>82% &rarr; 100%</b>', body_style)],
    [Paragraph('<b>Oct 26–28</b><br/>(Mon–Wed)', body_style), Paragraph('<b>Clinic Trials</b><br/>VetLink Animal Clinic', body_style), Paragraph('• Field testing with licensed veterinarians at VetLink Animal Clinic.<br/>• Collect ISO/IEC 25010 & UAT survey evaluations (Mean & SD).<br/>• Gather qualitative clinician feedback for Chapter 4.', body_style), Paragraph('<b>Objective 3 Complete</b>', body_style)],
    [Paragraph('<b>Oct 29</b><br/>(Thursday)', body_style), Paragraph('<b>Adviser Demo</b><br/>Sign-off', body_style), Paragraph('• Live demonstration of working PWA, WASM edge inference, and Rx slips.<br/>• Present preliminary clinic testing evaluation data.<br/>• <b>Secure signed Defense Approval Letter.</b>', body_style), Paragraph('<b>Approval Secured</b>', body_style)],
    [Paragraph('<b>Oct 30 &ndash; Nov 3</b>', body_style), Paragraph('<b>Manuscript Draft</b><br/>Chapters 1–5', body_style), Paragraph('• Insert Table 3.1 (19,094 images) and Table 3.2 into Chapter 3.<br/>• Transcribe Classification Report and Confusion Matrix into Chapter 4.<br/>• Submit complete Chapters 1–5 draft on November 3.', body_style), Paragraph('<b>Draft Submitted</b>', body_style)],
    [Paragraph('<b>Nov 4–8</b>', body_style), Paragraph('<b>Defense Prep</b><br/>Slide Deck', body_style), Paragraph('• Prepare 15-slide presentation deck focusing on multi-species, WASM, and CDSS.<br/>• Conduct team mock defense rehearsals and Q&A practice.', body_style), Paragraph('<b>Rehearsed</b>', body_style)],
    [Paragraph('<b>Nov 9–11</b>', body_style), Paragraph('<b>Final Oral Defense</b>', body_style), Paragraph('• Deliver professional live clinical demo and defend capstone research.', body_style), Paragraph('<b>GRADUATION</b>', body_style)],
]

t_road = Table(road_data, colWidths=[75, 95, 260, 74])
t_road.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e0e7ff')),
    ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#1e3a8a')),
    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#c7d2fe')),
    ('TOPPADDING', (0,0), (-1,-1), 3.5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
    ('LEFTPADDING', (0,0), (-1,-1), 5),
    ('RIGHTPADDING', (0,0), (-1,-1), 5),
]))
story.append(t_road)

doc.build(story, canvasmaker=NumberedCanvas)
print('PDF generated successfully at:', pdf_path)
