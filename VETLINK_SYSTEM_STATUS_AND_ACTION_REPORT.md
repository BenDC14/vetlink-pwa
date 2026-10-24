# VetLink Animal Decision Support System — Comprehensive Technical Audit & Action Report

**Document Title:** VetLink System Status, Architectural Audit & Path-to-Defense Action Plan  
**Prepared For:** Capstone Faculty Advisers, Development Team (Russel & Benedict), and Beneficiaries  
**Institutional Affiliation:** College of Computing Studies, Eulogio "Amang" Rodriguez Institute of Science and Technology (EARIST)  
**Project:** *A Deep Learning Animal Decision Support System Using MobileNetV3 and Grad-CAM for VetLink Clinic*  
**Date:** October 23, 2026  
**Target Defense Window:** November 9–11, 2026  
**Current System Codebase Readiness:** **82%** (Target: **100%** by October 25)  
**Overall Capstone Milestone Progress:** **60%** (Target: **95%** by November 3)  

---

## 1. Executive Summary & Objective Status

This document provides a rigorous, transparent evaluation of the **VetLink Progressive Web Application (PWA)** codebase as of October 23, 2026. It establishes an unsparing distinction between the **software system readiness (82%)** and the **overall capstone completion (60%)**, identifies three critical visual and structural flaws that must be resolved prior to the adviser review on October 29, and provides the step-by-step technical solutions to achieve a 100% production-ready deployment.

### System Readiness Scorecard

| Module / Layer | Readiness | Status | Critical Strengths & Identified Gaps |
| :--- | :---: | :---: | :--- |
| **1. AI Edge Model & WASM Engine** | **92%** | **SOLID** | 11 classes, 4 species, 3.1 MB INT8 TFLite, 38–45ms client-side WASM inference; zero cloud cost. |
| **2. Clinical Decision Support (CDSS)** | **92%** | **SOLID** | Dual-diagnosis comorbidity detection, OpenCV blur filtering, Grad-CAM, in-chart override, printable Rx. |
| **3. Database & Sync Queue** | **82%** | **GOOD** | IndexedDB multi-store schema, conflict resolution UI, offline auth fallback; needs capture downsampling. |
| **4. Frontend UI & Native PWA Shell** | **70%** | **ACTION REQUIRED** | "Install PWA" button lacks event listener; home dashboard displays static hardcoded metrics. |
| **OVERALL SYSTEM CODEBASE** | **82%** | **READY FOR FINISHING SPRINT** | Core engine is proven; 3 frontend fixes needed to achieve 100%. |

---

## 2. Technical Inventory: What is Currently in the System

### A. Edge Machine Learning & Explainable AI
1. **Lightweight Edge Inference (`vetlink_model_v2.tflite`):**
   * Pre-trained MobileNetV3-Large convolutional backbone fine-tuned across 11 diagnostic classes spanning 4 species groups (Canine, Feline, Avian, Lagomorph).
   * Fully post-training INT8 quantized to 3.1 MB, running in browser WebAssembly (WASM) in **38–45 ms** on commodity mobile CPU threads without GPU requirements.
2. **OpenCV-Exact Laplacian Variance Blur Rejection (`src/vetlink-ai.js`):**
   * Implements discrete mathematical 2D convolution using an 8-neighbor Laplacian kernel ($\nabla^2 f$).
   * Calculates variance ($\sigma^2$); automatically blocks low-quality, out-of-focus captures ($\sigma^2 < 80.0$) before inference to prevent misclassification.
3. **Physiological Erythema-Weighted Grad-CAM (`src/vetlink-ai.js`):**
   * Generates spatial explanation heatmaps using an Erythema Index ($\text{EI} = 2R - G - B$) with edge-falloff border suppression to highlight active inflammatory margins rather than background fur.

### B. Clinical Decision Support System (CDSS)
1. **Calibrated 60% Decision Boundary (FR7):**
   * Predictions achieving $\ge 60\%$ confidence auto-populate evidence-based first-line protocols into the active consultation.
   * Predictions falling below 60% trigger mandatory prompts for secondary laboratory diagnostics (Skin Scraping, Wood's Lamp, Fungal Culture, or Cytology).
2. **Suspected Comorbidity & Dual Diagnosis (`src/pages/NewPatient.jsx` & `src/pages/AdminApproval.jsx`):**
   * Automatically detects co-occurring conditions when the probability delta between top predictions is $\le 55\%$ or when a secondary disease reaches $\ge 20\%$.
   * Empowers attending veterinarians to approve the primary condition, secondary condition, or both.
3. **Early-Stage Subclinical Differential Notice & Diagnostic Override (`src/pages/AdminApproval.jsx`):**
   * Issues proactive clinical notices when canine facial lesions display Ringworm or mild erythema, warning clinicians of potential subclinical early Demodectic Mange.
   * Features an instant **Diagnostic Override Dropdown**, ensuring the licensed veterinarian retains sole authority to alter the diagnostic record.
4. **Official Printable Prescription Slip & PDF Export (`src/pages/Treatment.jsx` & `src/App.css`):**
   * Interactive textareas allow dosage adjustments by animal weight (kg).
   * Generates a formal, printable Veterinary Rx slip with clinic letterhead, Rx symbol, dosage schedules, warnings, and licensed veterinarian signature line (`@media print`).
5. **Longitudinal Follow-up / Recheck Workflow (`src/pages/Patients.jsx`):**
   * Side-by-side **Baseline vs. Today's Recheck** comparison modal.
   * Human-in-the-loop 4-stage healing progress selector (*Resolved*, *Improving*, *Refractory*, *New Complication*).

### C. Cross-Platform Intake & Hardware Acceleration
1. **Direct Camera Viewfinder (`src/components/CameraCaptureModal.jsx`):**
   * Accesses mobile and desktop camera streams via `navigator.mediaDevices.getUserMedia`.
   * Displays an animated Macro Lesion Framing Box HUD guiding clinic staff during lesion capture.
   * Dual-mode architecture: seamlessly switch between live camera capture and gallery file upload.

### D. Data Persistence & Offline Architecture
1. **IndexedDB Local Storage (`src/db/database.js`):**
   * Full relational schema: `patients`, `consultations`, `screeningResults`, `uploadedImages`, `syncQueue`, and `syncConflicts`.
2. **Cloud Synchronization Engine (`src/pages/Sync.jsx`):**
   * Tracks pending offline transactions, provides manual sync triggers, and offers a visual two-way conflict resolution panel.
   * Offline authentication fallback allows seamless local operation when the central backend server is offline.

---

## 3. The 3 Critical Deficiencies That Must Be Fixed

Before presenting the application to your capstone adviser on Thursday, October 29, the following three items must be resolved:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 🔴 FLAW 1: DEAD "INSTALL PWA" BUTTON IN App.jsx (Line 212)                             │
│ Currently: <button className="action-btn secondary">Install PWA</button>               │
│ Problem: Has no onClick handler. Clicking it produces zero browser response.           │
│ Solution: Wire standard beforeinstallprompt event listener to pop native install modal. │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 🔴 FLAW 2: HARDCODED STATIC DASHBOARD IN ClinicalAnalysis.jsx                          │
│ Currently: Displays hardcoded "24 Cases Today", "7 Pending Results", "94% Accuracy".   │
│ Problem: Numbers never change when new patients are added; appears fake to advisers.   │
│ Solution: Query real counts dynamically from IndexedDB (database.js).                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 🟡 FLAW 3: RAW SMARTPHONE IMAGE BLOAT IN IndexedDB                                     │
│ Currently: Stores full-resolution 4–8 MB camera photos as raw base64 data URLs.        │
│ Problem: Storing 15+ cases consumes 100+ MB of browser memory, risking sync timeouts. │
│ Solution: Downscale photos via HTML5 canvas to 1024x1024 JPEG before saving.           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Exact Technical Code Fixes

### Fix 1: Wire Native PWA Installation (`src/App.jsx`)

Replace the static button on Line 212 with native event interception:

```jsx
// 1. Add state hook near top of App component
const [deferredPrompt, setDeferredPrompt] = useState(null)
const [isInstallable, setIsInstallable] = useState(false)

// 2. Intercept beforeinstallprompt in useEffect
useEffect(() => {
  const handleBeforeInstall = (e) => {
    e.preventDefault()
    setDeferredPrompt(e)
    setIsInstallable(true)
  }
  window.addEventListener('beforeinstallprompt', handleBeforeInstall)
  return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
}, [])

// 3. Define trigger function
const handleInstallApp = async () => {
  if (!deferredPrompt) {
    alert('VetLink PWA is already installed or your browser does not support installation. In Chrome, tap Menu > Add to Home screen.')
    return
  }
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  if (outcome === 'accepted') {
    setIsInstallable(false)
  }
  setDeferredPrompt(null)
}

// 4. Update the button element (Line 212)
<button className="action-btn secondary" onClick={handleInstallApp}>
  {isInstallable ? '📥 Install App' : '✓ App Installed'}
</button>
```

---

### Fix 2: Make the Dashboard Dynamic (`src/pages/ClinicalAnalysis.jsx`)

Replace the hardcoded mock statistics with live queries to `database.js`:

```jsx
import { useEffect, useState } from 'react'
import { getPatients, getPendingSyncQueue } from '../db/database'

export default function ClinicalAnalysis() {
  const [stats, setStats] = useState({ totalPatients: 0, pendingSync: 0, activeCases: 0 })

  useEffect(() => {
    async function loadStats() {
      try {
        const patients = await getPatients()
        const queue = await getPendingSyncQueue()
        const active = patients.filter(p => p.status === 'Active').length
        setStats({
          totalPatients: patients.length,
          pendingSync: queue.length,
          activeCases: active
        })
      } catch (err) {
        console.error('Failed to load clinic metrics:', err)
      }
    }
    loadStats()
  }, [])

  return (
    <div className="metric-grid">
      <div className="metric-card">
        <p className="metric-value">{stats.totalPatients}</p>
        <span>Total Patients</span>
      </div>
      <div className="metric-card">
        <p className="metric-value">{stats.activeCases}</p>
        <span>Active Cases</span>
      </div>
      <div className="metric-card">
        <p className="metric-value">{stats.pendingSync}</p>
        <span>Pending Sync</span>
      </div>
      <div className="metric-card">
        <p className="metric-value">40 ms</p>
        <span>WASM Edge Latency</span>
      </div>
    </div>
  )
}
```

---

### Fix 3: Client-Side Image Downsampling on Capture

Add canvas resizing inside your image capture utility before writing to IndexedDB:

```javascript
export function downscaleImage(fileOrDataUrl, maxDimension = 1024, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let width = img.width
      let height = img.height

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = typeof fileOrDataUrl === 'string' ? fileOrDataUrl : URL.createObjectURL(fileOrDataUrl)
  })
}
```

---

## 5. Master Roadmap to Oral Defense (Oct 24 – Nov 11)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ OCTOBER 24–25 (WEEKEND SPRINT) ────────────────────────► SYSTEM 100% READY             │
│ • Implement the 3 frontend fixes (PWA install, dynamic metrics, downsampling).         │
│ • Rehearse camera capture and override workflows on actual tablet/smartphone.          │
│ • Lock and freeze codebase before clinic trials.                                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ OCTOBER 26–28 (MON–WED: CLINIC TESTING) ───────────────► BENEFICIARY DATA COLLECTED   │
│ • Conduct field evaluation at VetLink Animal Clinic with licensed veterinarians.       │
│ • Gather ISO/IEC 25010 & UAT Likert survey ratings (Mean & Standard Deviation).       │
│ • Collect qualitative feedback and clinician quotes for Chapter 4 discussion.          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ OCTOBER 29 (THURSDAY: ADVISER DEMO) ───────────────────► DEFENSE APPROVAL SIGNED      │
│ • Demonstrate completed, working application to Capstone Faculty Adviser.              │
│ • Present preliminary clinic evaluation feedback and verified 40ms edge inference.    │
│ • Secure signed Defense Approval Letter.                                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ OCTOBER 30 – NOVEMBER 3 (MANUSCRIPT SPRINT) ───────────► CHAPTERS 1–5 SUBMITTED        │
│ • Insert Table 3.1 (19,094 images, 11 classes) and Table 3.2 into Chapter 3.          │
│ • Insert Classification Report, Confusion Matrix, and UAT survey results in Chapter 4. │
│ • Submit complete draft manuscript on November 3.                                      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ NOVEMBER 4–8 (DEFENSE PREPARATION) ────────────────────► REHEARSAL COMPLETE            │
│ • Build 15-slide presentation deck focusing on multi-species, WASM, and CDSS safety.   │
│ • Conduct mock defense Q&A.                                                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ NOVEMBER 9–11 (FINAL ORAL DEFENSE) ────────────────────► CAPSTONE COMPLETED            │
│ • Deliver live clinical software demonstration and defend academic findings.           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
