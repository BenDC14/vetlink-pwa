import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
    PageBreak,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas that renders 'Page X of Y' and standard header/footer."""
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
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Running Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(
                36,
                letter[1] - 28,
                "VETLINK CLINICAL SYSTEM -- COMPREHENSIVE TESTING & VERIFICATION GUIDE"
            )
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(36, letter[1] - 32, letter[0] - 36, letter[1] - 32)

        # Running Footer (all pages)
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(36, 36, letter[0] - 36, 36)

        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawString(
            36,
            24,
            "Republic Act 9268 Compliant  |  Department of Clinical Veterinary Dermatology"
        )
        self.drawRightString(letter[0] - 36, 24, page_str)
        self.restoreState()


def build_pdf(output_paths):
    target_primary = output_paths[0]
    doc = SimpleDocTemplate(
        target_primary,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=42,
        bottomMargin=46,
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    c_navy = colors.HexColor("#0f172a")
    c_blue = colors.HexColor("#1e3a8a")
    c_slate = colors.HexColor("#334155")
    c_muted = colors.HexColor("#64748b")
    c_teal = colors.HexColor("#0f766e")
    c_border = colors.HexColor("#cbd5e1")
    c_bg_light = colors.HexColor("#f8fafc")

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=c_navy,
        alignment=1,
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=c_blue,
        alignment=1,
    )
    meta_style = ParagraphStyle(
        "DocMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=c_muted,
        alignment=1,
    )
    h1_style = ParagraphStyle(
        "SectionH1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=c_navy,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True,
    )
    h2_style = ParagraphStyle(
        "SectionH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        textColor=c_blue,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    )
    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.8,
        leading=12.5,
        textColor=c_slate,
    )
    body_bold = ParagraphStyle(
        "BodyDarkBold",
        parent=body_style,
        fontName="Helvetica-Bold",
    )
    badge_style = ParagraphStyle(
        "BadgeText",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0369a1"),
    )
    code_style = ParagraphStyle(
        "CodeText",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0f172a"),
    )
    table_cell = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.2,
        leading=11,
        textColor=c_slate,
    )
    table_header = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11.5,
        textColor=colors.white,
    )

    story = []

    # Clinic Header Block
    story.append(Paragraph("VETLINK ANIMAL CARE CLINIC & HOSPITAL", title_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("CLINICAL SYSTEM TESTING & VERIFICATION GUIDE", subtitle_style))
    story.append(Spacer(1, 3))
    story.append(
        Paragraph(
            "Document Ref: VL-VERIF-2026-1110  |  Republic Act 9268 Compliant  |  Date: November 10, 2026",
            meta_style,
        )
    )
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_navy, spaceBefore=0, spaceAfter=10))

    # Executive Overview
    story.append(Paragraph("1. Executive Summary & Completed Deliverables", h1_style))
    story.append(
        Paragraph(
            "This document establishes the official verification procedures and functional test specifications "
            "for the VetLink Veterinary Clinical Intelligence Platform. On November 10, 2026, critical system "
            "upgrades were deployed across backend microservices, client state management, dynamic licensure "
            "compliance, and multi-channel prescription fulfillment.",
            body_style,
        )
    )
    story.append(Spacer(1, 8))

    # Completed Deliverables Table
    deliv_headers = [
        Paragraph("Feature / Module", table_header),
        Paragraph("Technical Implementation", table_header),
        Paragraph("Clinical Impact & Verification Status", table_header),
    ]
    deliv_data = [
        deliv_headers,
        [
            Paragraph("<b>Dynamic Clinician Licensure (RA 9268)</b>", table_cell),
            Paragraph("Added customizable PRC License No. and PTR No. fields in Settings.jsx, persisted in IndexedDB staff store and synchronized across treatment plans, lab requisition slips, and vector PDF attachments.", table_cell),
            Paragraph("Complies with Philippine Veterinary Medicine Act (RA 9268). Eliminates static hardcoding; each attending clinician maintains their personal accreditation numbers.", table_cell),
        ],
        [
            Paragraph("<b>Live Cloud Gmail SMTP Dispatch</b>", table_cell),
            Paragraph("Integrated Google SMTP TLS transport (smtp.gmail.com:587) with automated space trimming for Google 16-character App Passwords. Dual envelope routing and fallback to local queue simulation.", table_cell),
            Paragraph("Direct cloud dispatch of official prescriptions to pet owners without client mail software dependency. Verified live authentication against Google production servers.", table_cell),
        ],
        [
            Paragraph("<b>Authentic Vector PDF Generator</b>", table_cell),
            Paragraph("Implemented ReportLab vector PDF generator (main.py) building printable prescriptions with formal clinic letterhead, patient/owner metadata, diagnosis, Rx symbol, and attending doctor signature block.", table_cell),
            Paragraph("Dispatched as official email attachment (Prescription_[Patient]_[RxID].pdf) and instantly downloadable via the 'Download Official Prescription (PDF)' button.", table_cell),
        ],
        [
            Paragraph("<b>Desktop Modal Flexbox Layout</b>", table_cell),
            Paragraph("Refactored modal dialogs in Patients.jsx (Edit Patient, Review Case, Recheck Follow-Up) to 3-tier native flexbox containers: sticky header, scrollable body, and anchored bottom footer.", table_cell),
            Paragraph("Permanently eliminates floating, drifting, or overlapping action buttons on wide desktop screens. Action controls remain docked at bottom regardless of window height.", table_cell),
        ],
        [
            Paragraph("<b>Nomenclature Standardization</b>", table_cell),
            Paragraph("Replaced taxonomic clade nomenclature ('Lagomorph') with standard clinical category ('Rabbit') across patient filters, intake dropdowns, and records management.", table_cell),
            Paragraph("Aligned clinical UI with standard veterinary hospital intake protocols and pet owner comprehension.", table_cell),
        ],
        [
            Paragraph("<b>Action Bar Optimization</b>", table_cell),
            Paragraph("Removed redundant 'Email Rx' button in Recheck Follow-Up modal; centralized full prescription editing and dispatch inside dedicated Treatment Protocol Editor.", table_cell),
            Paragraph("Eliminates staff operational confusion; prevents premature prescription dispatch before case progression is saved.", table_cell),
        ],
        [
            Paragraph("<b>Zero Emoji Interface Audit</b>", table_cell),
            Paragraph("Comprehensive unicode regex audit executed across all frontend JSX components, backend endpoints, and document generation modules. Replaced all symbols with standard typography.", table_cell),
            Paragraph("Strict professional medical interface styling suitable for academic evaluation, clinical presentations, and thesis panel defense.", table_cell),
        ],
    ]

    deliv_table = Table(deliv_data, colWidths=[130, 230, 180])
    deliv_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), c_blue),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, c_border),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, c_bg_light]),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(deliv_table)
    story.append(Spacer(1, 14))

    # Section 2: Environment Configuration
    story.append(Paragraph("2. System Pre-Requisites & Configuration Check", h1_style))
    story.append(
        Paragraph(
            "Prior to executing the test protocols, verify that the environment variables in <code>backend/.env</code> "
            "and client local services are running with the following parameters:",
            body_style,
        )
    )
    story.append(Spacer(1, 6))

    env_headers = [
        Paragraph("Parameter", table_header),
        Paragraph("Configured Value", table_header),
        Paragraph("Functional Scope", table_header),
    ]
    env_data = [
        env_headers,
        [Paragraph("SMTP_HOST", table_cell), Paragraph("smtp.gmail.com", code_style), Paragraph("Outbound Gmail SMTP relay server", table_cell)],
        [Paragraph("SMTP_PORT", table_cell), Paragraph("587", code_style), Paragraph("STARTTLS encrypted transmission port", table_cell)],
        [Paragraph("SMTP_USER", table_cell), Paragraph("vetlinkemail@gmail.com", code_style), Paragraph("Authenticated clinic service account", table_cell)],
        [Paragraph("SMTP_PASSWORD", table_cell), Paragraph("[16-char Google App Password]", code_style), Paragraph("Cleaned of whitespace automatically by backend", table_cell)],
        [Paragraph("SMTP_FROM", table_cell), Paragraph("clinic@vetlink.ph", code_style), Paragraph("Sender letterhead display address", table_cell)],
        [Paragraph("ALLOW_SIMULATED_EMAIL", table_cell), Paragraph("true", code_style), Paragraph("Offline simulated queueing fallback", table_cell)],
        [Paragraph("API_PORT", table_cell), Paragraph("8000", code_style), Paragraph("FastAPI REST backend microservice port", table_cell)],
    ]
    env_table = Table(env_data, colWidths=[140, 180, 220])
    env_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), c_navy),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.5, c_border),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, c_bg_light]),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(env_table)
    story.append(Spacer(1, 14))

    # Page Break for Testing Protocols
    story.append(PageBreak())

    # Section 3: Detailed 12-Point Testing Protocols
    story.append(Paragraph("3. Step-by-Step Clinical System Testing Protocols", h1_style))
    story.append(
        Paragraph(
            "Evaluators, thesis teammates, and clinical veterinarians should execute the following 12 testing protocols "
            "sequentially to verify complete operational integrity of the VetLink application.",
            body_style,
        )
    )
    story.append(Spacer(1, 8))

    protocols = [
        {
            "id": "Protocol 1",
            "title": "Attending Clinician Profile & Licensure Customization (RA 9268)",
            "steps": [
                "1. Navigate to 'Settings' via the sidebar or top navigation bar.",
                "2. Under 'Account & Clinical Profile', observe the current clinician display name, PRC License No., and PTR No. badges.",
                "3. Click 'Edit Profile'. Modify the 'PRC License Number' (e.g. input personal license or test code: VET-992144) and 'PTR Number' (e.g. 8831092).",
                "4. Click 'Save Profile'. Verify the success notification appears: 'Display name updated successfully!'.",
                "5. Confirm that the new PRC and PTR badges render immediately without page refresh.",
            ],
            "expected": "Licensure data is saved locally to IndexedDB and state. Subsequent prescriptions automatically reflect the updated doctor credentials.",
        },
        {
            "id": "Protocol 2",
            "title": "Mobile Media Picker & Real-Time Upload Percentage Indicator",
            "steps": [
                "1. Navigate to 'New Patient Intake' (from mobile device or simulated mobile viewport).",
                "2. Click the 'Upload File' button under the clinical lesion intake card.",
                "3. Verify that the device file manager / photo gallery opens immediately (confirming HTML capture attribute was removed).",
                "4. Select an image file. Observe the real-time upload progress indicator.",
                "5. Verify that numerical percentage increments smoothly from 0% -> 35% (Reading File) -> 75% (Optimizing Resolution) -> 100% (Lesion Loaded).",
            ],
            "expected": "Mobile users can choose existing photos from storage without forced camera launch. Percentage indicator provides positive visual feedback.",
        },
        {
            "id": "Protocol 3",
            "title": "Lesion Quality & Biological Filter Screening (Animal-Only Guardrail)",
            "steps": [
                "1. Test Negative Sample 1 (Blank/Wall): Upload an image of a blank white sheet or solid wall. Verify immediate rejection: 'Image Rejected: Blank / Obstructed Surface'.",
                "2. Test Negative Sample 2 (Digital Screen): Upload a photo taken of a computer monitor or LCD screen. Verify rejection: 'Image Rejected: Computer Monitor / Digital Screen Detected'.",
                "3. Test Negative Sample 3 (Blurry): Upload an intentional motion-blurred image. Verify rejection: 'Image Rejected: Motion Blur'.",
                "4. Test Positive Clinical Sample: Upload an authentic canine or feline cutaneous lesion (e.g., mange, fungal dermatophytosis).",
                "5. Observe AI lesion confidence distribution and species detection banner.",
            ],
            "expected": "Non-clinical, non-animal, and synthetic images are rejected immediately before AI inference, preventing false diagnoses.",
        },
        {
            "id": "Protocol 4",
            "title": "Patient Intake & Automated Consultation Routing",
            "steps": [
                "1. In 'New Patient Intake', fill in required fields: Patient Name ('Buddy'), Species ('Canine'), Breed ('Aspin'), Weight ('6 kg'), Owner Name ('Juan Dela Cruz').",
                "2. In 'Owner Email (Optional / For Rx Dispatch)', enter an email address (e.g. recipient personal email) or leave blank for emergency intake.",
                "3. Select Clinical Area of Concern ('Back / Trunk').",
                "4. Click 'Save and Proceed to Consultation Rx'.",
                "5. Confirm that the application transitions immediately to the Treatment page with patient metadata and preliminary diagnosis intact.",
            ],
            "expected": "Zero IndexedDB schema errors; seamless navigation into treatment workflow without lost intake data.",
        },
        {
            "id": "Protocol 5",
            "title": "Treatment Protocol Review, Dosage Customization & Recheck Orders",
            "steps": [
                "1. On the Treatment page, observe the standardized pharmacological protocol automatically matched to the diagnosis (e.g. Canine Mange -> NexGard Spectra / Chlorhexidine Shampoo).",
                "2. In 'Prescription / Medication Dispensing Order', customize dosage or add specific patient instructions.",
                "3. In 'Doctor's Progression & Home Care Notes', input clinical home hygiene instructions.",
                "4. Scroll down to the Attending Veterinarian signature block. Verify that the attending doctor's name, PRC License No., and PTR No. match the values saved in Protocol 1.",
            ],
            "expected": "Dynamic clinician licensure is accurately bound to the prescription form. Protocol text is fully editable.",
        },
        {
            "id": "Protocol 6",
            "title": "Official Vector PDF Prescription Generation & 1-Click Download",
            "steps": [
                "1. On the Treatment page, click 'Email Prescription' (or 'Email to Owner').",
                "2. In the Email Prescription Modal, locate the action button: 'Download Official Prescription (PDF)'.",
                "3. Click 'Download Official Prescription (PDF)'.",
                "4. Observe browser download of file: Prescription_[PatientName]_[RxID].pdf.",
                "5. Open the downloaded PDF: Verify authentic clinic letterhead, structured patient metadata, Rx symbol, medication orders, and attending doctor signature block.",
            ],
            "expected": "Binary vector PDF generates cleanly within 300ms without layout clipping or text truncation.",
        },
        {
            "id": "Protocol 7",
            "title": "Live Cloud Gmail SMTP Dispatch with PDF Attachment",
            "steps": [
                "1. Inside the Email Prescription Modal, verify that 'Owner Email Address' contains a valid recipient email (or enter a test email address).",
                "2. Verify that the checkbox 'Save email to patient profile for future consultations' is checked.",
                "3. Observe the green attachment badge: 'Attachment: Prescription_[PatientName]_[RxID].pdf (Official PDF)'.",
                "4. Click 'Send Prescription via Clinic Cloud SMTP'.",
                "5. Verify that button changes to 'Dispatching Prescription via SMTP...'.",
                "6. Verify success alert: 'Official prescription with attached PDF successfully emailed to [recipient]'.",
                "7. Open recipient email inbox: Verify received email contains formatted HTML letterhead AND the attached vector PDF prescription.",
            ],
            "expected": "Email arrives in recipient inbox with correct sender name, diagnosis summary, medication orders, and downloadable official PDF.",
        },
        {
            "id": "Protocol 8",
            "title": "Direct Gmail Web & Device Mail Client Redirection",
            "steps": [
                "1. In the Email Prescription Modal, click 'Open in Gmail Web'.",
                "2. Verify a new browser tab opens to 'https://mail.google.com/mail/?view=cm...' with pre-filled recipient email, subject, and prescription body.",
                "3. Click 'Open in Device Mail App'. Verify that native mail client (Outlook, Apple Mail, or Thunderbird) launches with pre-filled mailto parameters.",
                "4. Click 'Copy Text' and verify that clipboard receives plain text prescription with notification 'Copied to clipboard'.",
            ],
            "expected": "Provides complete fail-safe redundancy if internet connection is restricted or SMTP servers are unreachable.",
        },
        {
            "id": "Protocol 9",
            "title": "Desktop Responsive Modal Layout & Button Anchoring",
            "steps": [
                "1. Navigate to 'Patients' record table on a desktop computer (or maximize browser window to 1920x1080).",
                "2. Locate a patient record and click 'Edit Patient'.",
                "3. Verify that the modal window renders with fixed header, internal scrollable form body, and anchored bottom footer.",
                "4. Scroll up and down inside the form body. Verify that 'Save Changes' and 'Cancel' buttons stay docked at bottom and NEVER float over text fields.",
                "5. Repeat check on 'Review Case' modal and 'Clinical Follow-Up (Recheck)' modal.",
            ],
            "expected": "Clean 3-tier flexbox dialog behavior with zero button overlap or UI bleed.",
        },
        {
            "id": "Protocol 10",
            "title": "Clinical Lesion Pan & Zoom Inspection Lightbox",
            "steps": [
                "1. In 'Patients', click on any patient case with an attached clinical lesion image.",
                "2. In the patient review drawer or case summary, click the lesion image thumbnail.",
                "3. Observe that the interactive full-screen Lightbox opens with dark backdrop.",
                "4. Use the '+' and '-' zoom controls to inspect lesion borders up to 5.0x magnification.",
                "5. Click 'Rotate' to adjust orientation; click and drag to pan across the lesion surface.",
                "6. Click 'Reset' to return to 1.0x; press Escape or click Close to dismiss lightbox.",
            ],
            "expected": "High-fidelity diagnostic visual inspection without loss of image aspect ratio or browser freeze.",
        },
        {
            "id": "Protocol 11",
            "title": "Clinical Follow-up Recheck Progression Evaluation",
            "steps": [
                "1. In 'Patients', click 'Recheck' on an active case.",
                "2. In the Recheck Modal, select clinical status: 'Responding / Improving', 'Refractory / Unchanged', or 'Suspected New Complication'.",
                "3. Verify that the previous redundant 'Email Rx' button is absent, leaving clean options: 'Cancel', 'Open Full Rx Protocol Editor', and 'Save Follow-Up Consultation'.",
                "4. Input Doctor's Progression Notes and click 'Save Follow-Up Consultation'.",
                "5. Verify that visit is appended to Patient Medical Record History.",
            ],
            "expected": "Clinical history chronological integrity preserved; streamlined actions prevent data corruption.",
        },
        {
            "id": "Protocol 12",
            "title": "Offline-First Architecture, Cloud Sync & Session Switching",
            "steps": [
                "1. Disconnect network / disable Wi-Fi (simulate rural veterinary clinic field operation).",
                "2. Intake a patient, review treatment protocol, and save prescription locally.",
                "3. Verify notification: 'Offline Mode: Data saved to local clinical storage'.",
                "4. Reconnect network; click 'Sync Cloud' in settings or wait for automated synchronization.",
                "5. In Settings, test switching accounts or click 'Log Out'. Verify session terminates immediately without network freeze.",
            ],
            "expected": "Full zero-latency offline operation with automated cloud queue reconciliation.",
        },
    ]

    for p in protocols:
        p_card = []
        p_header = [
            Paragraph(f"<b>{p['id']}</b>", badge_style),
            Paragraph(f"<b>{p['title']}</b>", h2_style),
        ]
        p_card.append(
            Table(
                [[p_header[0], p_header[1]]],
                colWidths=[70, 470],
                style=[
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ],
            )
        )
        step_paragraphs = [Paragraph(step, body_style) for step in p["steps"]]
        for sp in step_paragraphs:
            p_card.append(sp)
            p_card.append(Spacer(1, 2))

        p_card.append(Spacer(1, 3))
        p_card.append(
            Table(
                [[Paragraph(f"<b>Expected Clinical Outcome:</b> {p['expected']}", table_cell)]],
                colWidths=[540],
                style=[
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ],
            )
        )
        p_card.append(Spacer(1, 10))
        story.append(KeepTogether(p_card))

    # Page Break for Verification & Sign-off
    story.append(PageBreak())

    # Section 4: Academic Defense & Clinic Verification Sign-off
    story.append(Paragraph("4. Academic Defense & Clinical Panel Verification Sign-Off", h1_style))
    story.append(
        Paragraph(
            "This sign-off certificate formally documents that the VetLink Veterinary Clinical Platform has been tested "
            "and evaluated in accordance with the 12 testing protocols specified in this guide. The signatures below "
            "attest that all functional modules, dynamic licensure configurations, and clinical safety guardrails are "
            "fully operational and compliant with Republic Act 9268.",
            body_style,
        )
    )
    story.append(Spacer(1, 16))

    sign_data = [
        [
            Paragraph("<b>LEAD SOFTWARE RESEARCHER / DEVELOPER</b>", table_cell),
            Paragraph("<b>ATTENDING CLINICAL VETERINARIAN</b>", table_cell),
        ],
        [
            Paragraph("<br/><br/>________________________________________<br/><b>Developer Signature over Printed Name</b><br/>Lead System Architect &bull; VetLink PWA", table_cell),
            Paragraph("<br/><br/>________________________________________<br/><b>Veterinarian Signature over Printed Name</b><br/>Attending Clinician &bull; PRC Lic. Verified", table_cell),
        ],
        [
            Paragraph("<br/>Date Verified: _______________________", table_cell),
            Paragraph("<br/>PRC License No.: _____________________", table_cell),
        ],
        [
            Paragraph("<br/><b>CAPSTONE ADVISER / PROJECT COORDINATOR</b>", table_cell),
            Paragraph("<br/><b>TECHNICAL PANEL EVALUATOR / CHAIR</b>", table_cell),
        ],
        [
            Paragraph("<br/><br/>________________________________________<br/><b>Adviser Signature over Printed Name</b><br/>College of Information and Communications Tech", table_cell),
            Paragraph("<br/><br/>________________________________________<br/><b>Panel Chair Signature over Printed Name</b><br/>Capstone Defense Panel Committee", table_cell),
        ],
        [
            Paragraph("<br/>Date Verified: _______________________", table_cell),
            Paragraph("<br/>Action Taken: [  ] Approved  [  ] Revisions", table_cell),
        ],
    ]

    sign_table = Table(sign_data, colWidths=[270, 270])
    sign_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, c_border),
            ("BACKGROUND", (0, 0), (-1, 0), c_bg_light),
            ("BACKGROUND", (0, 3), (-1, 3), c_bg_light),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ])
    )
    story.append(sign_table)
    story.append(Spacer(1, 20))

    story.append(
        Paragraph(
            "<b>Institutional Accreditation Note:</b> All algorithmic suggestions provided by VetLink are decision-support "
            "advisories and require clinical validation by a licensed veterinarian prior to therapeutic administration.",
            meta_style,
        )
    )

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Generated primary PDF at: {target_primary}")

    # Copy to all target paths
    with open(target_primary, "rb") as fp:
        pdf_content = fp.read()

    for p in output_paths[1:]:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "wb") as fp:
            fp.write(pdf_content)
        print(f"Copied PDF to: {p}")

    print("All PDF distributions successfully created.")


if __name__ == "__main__":
    out_paths = [
        r"C:\Users\Admin\Documents\college shit\Capstone\Vetlink\vetlink-pwa\Updates on the system\progress summary\Vetlink_System_Testing_and_Verification_Guide.pdf",
        r"C:\Users\Admin\Documents\college shit\Capstone\Vetlink\vetlink-pwa\Updates on the system\feature updates\VETLINK_NOV10_FEATURE_UPDATE_AND_TESTING_GUIDE.pdf",
        r"C:\Users\Admin\.gemini\antigravity\brain\29f89b92-a290-4a25-a3ca-303314853942\Vetlink_System_Testing_and_Verification_Guide.pdf",
    ]
    build_pdf(out_paths)
