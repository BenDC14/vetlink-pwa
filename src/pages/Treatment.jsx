import { useState } from 'react'
import { updateConsultation } from '../db/database'

const TREATMENT_PROTOCOLS = {
  // ── Avian Fowl Pox ──────────────────────────────────────────
  'Avian Fowl Pox': {
    treatment: [
      'Gentle antiseptic cleansing of cutaneous pox lesions with dilute povidone-iodine (1:10 dilution)',
      'Vitamin A supplementation (oral drop or water-soluble) to promote epithelial mucosal healing',
      'Isolate affected bird from flock to prevent vector (mosquito) transmission',
      'Provide soft, easily digestible nutrition and monitor weight daily',
    ],
    prescription: 'Topical povidone-iodine 1% swab BID + Vitamin A avian oral supplement for 21 days.',
    notes: 'Cutaneous (dry) fowl pox is usually self-limiting in 3–4 weeks. Seek emergency care if diphtheritic (wet/mouth) lesions or dyspnea develop.',
  },

  // ── Bird Healthy ────────────────────────────────────────────
  'Bird_Healthy': {
    treatment: [
      'Patient is dermatologically healthy. Plumage, cere, beak, and legs show normal integrity.',
      'No medical or pharmacological treatment indicated.',
      'Maintain balanced avian nutrition (species-specific pellets, fresh greens, and seed moderation).',
      'Provide clean bathing water daily and maintain adequate ambient cage ventilation.',
    ],
    prescription: 'None required (Patient is healthy).',
    notes: 'Routine avian wellness checkup documented. Schedule routine annual veterinary examination.',
  },
  'Healthy (Bird)': {
    treatment: [
      'Patient is dermatologically healthy. Plumage, cere, beak, and legs show normal integrity.',
      'No medical or pharmacological treatment indicated.',
      'Maintain balanced avian nutrition (species-specific pellets, fresh greens, and seed moderation).',
      'Provide clean bathing water daily and maintain adequate ambient cage ventilation.',
    ],
    prescription: 'None required (Patient is healthy).',
    notes: 'Routine avian wellness checkup documented. Schedule routine annual veterinary examination.',
  },

  // ── Scaly Face / Leg Mite (Avian) ───────────────────────────
  'Scaly Face Scaly Leg Mite (Knemidocoptes)': {
    treatment: [
      'Topical or oral Ivermectin (0.2 mg/kg) applied to unfeathered skin of neck or under-wing',
      'Repeat dosing at 10–14 day intervals for 2–3 treatments to eliminate newly hatched mites',
      'Apply thin layer of sterile mineral oil or paraffin sparingly to beak and leg crusts to suffocate mites (DO NOT obstruct nares/nostrils)',
      'Thoroughly sanitize cage, perches, and toys in hot soapy water or safe aviary disinfectant',
    ],
    prescription: 'Ivermectin 1% spot-on (1 drop topically on skin of back of neck), repeat on Day 14 and Day 28.',
    notes: 'Treat all in-contact cage mates. Monitor beak symmetry as chronic infestations can cause permanent beak malformation.',
  },
  'Scaly Face / Leg Mite': {
    treatment: [
      'Topical or oral Ivermectin (0.2 mg/kg) applied to unfeathered skin of neck or under-wing',
      'Repeat dosing at 10–14 day intervals for 2–3 treatments to eliminate newly hatched mites',
      'Apply thin layer of sterile mineral oil or paraffin sparingly to beak and leg crusts to suffocate mites (DO NOT obstruct nares/nostrils)',
      'Thoroughly sanitize cage, perches, and toys in hot soapy water or safe aviary disinfectant',
    ],
    prescription: 'Ivermectin 1% spot-on (1 drop topically on skin of back of neck), repeat on Day 14 and Day 28.',
    notes: 'Treat all in-contact cage mates. Monitor beak symmetry as chronic infestations can cause permanent beak malformation.',
  },

  // ── Canine / Feline Healthy ─────────────────────────────────
  'Healthy': {
    treatment: [
      'Patient dermatological status is clinically normal. Skin barrier intact with no erythema, crusting, or alopecia.',
      'No medical or topical dermatological therapy required.',
      'Maintain routine veterinary ectoparasite prevention (flea, tick, and mite preventative).',
      'Maintain regular grooming, balanced diet, and fresh water access.',
    ],
    prescription: 'None required (Patient is healthy).',
    notes: 'Normal physical and integumentary exam. Return for routine annual wellness checkup and vaccinations.',
  },

  // ── Canine / Feline Hotspots ────────────────────────────────
  'Hotspots': {
    treatment: [
      'Gently clip fur around the moist dermatitis lesion to allow air exposure and drying',
      'Cleanse lesion with dilute antiseptic chlorhexidine solution (2%)',
      'Apply topical antimicrobial and anti-inflammatory spray or cream twice daily',
      'Place Elizabethan collar (cone) to prevent licking, scratching, and self-trauma',
    ],
    prescription: 'Gentamicin sulfate 0.1% + Betamethasone valerate 0.1% topical spray BID for 7 days.',
    notes: 'Acute moist dermatitis is often secondary to flea allergy, ear infection, or atopy. Investigate primary trigger if recurrent.',
  },
  'Hot Spots': {
    treatment: [
      'Gently clip fur around the moist dermatitis lesion to allow air exposure and drying',
      'Cleanse lesion with dilute antiseptic chlorhexidine solution (2%)',
      'Apply topical antimicrobial and anti-inflammatory spray or cream twice daily',
      'Place Elizabethan collar (cone) to prevent licking, scratching, and self-trauma',
    ],
    prescription: 'Gentamicin sulfate 0.1% + Betamethasone valerate 0.1% topical spray BID for 7 days.',
    notes: 'Acute moist dermatitis is often secondary to flea allergy, ear infection, or atopy. Investigate primary trigger if recurrent.',
  },

  // ── Canine / Feline Mange ───────────────────────────────────
  'Mange': {
    treatment: [
      'Isoxazoline systemic acaricide therapy (e.g. Fluralaner / Bravecto, Afoxolaner / NexGard, or Selamectin / Revolution)',
      'Medicated antiseptic/keratolytic bath (Benzoyl Peroxide or Chlorhexidine) to loosen crusts and reduce secondary microbes',
      'Wash all bedding, blankets, and grooming tools in hot water (>60°C)',
      'Treat all in-contact household pets simultaneously',
    ],
    prescription: 'Isoxazoline chewable single oral dose according to body weight, or Selamectin spot-on. Re-evaluate in 30 days.',
    notes: 'Sarcoptic mange (scabies) is highly contagious and mildly zoonotic to humans. Wear gloves during handling until resolved.',
  },

  // ── Canine / Feline Pyoderma ────────────────────────────────
  'Pyoderma': {
    treatment: [
      'Topical antimicrobial therapy: Chlorhexidine 3–4% medicated shampoo baths twice weekly with 10-minute contact time',
      'Systemic oral antibiotics (Cephalexin or Amoxicillin-Clavulanate) for 14–21 days if lesions are deep or generalized',
      'Identify and treat underlying predisposing conditions (flea allergy, atopy, or endocrine disease)',
      'Schedule follow-up clinical examination and cytology in 14 days',
    ],
    prescription: 'Cephalexin 22 mg/kg PO BID for 14–21 days + Chlorhexidine 4% mousse/shampoo twice weekly.',
    notes: 'Recheck cytology in 2 weeks. Continue antibiotic therapy for a minimum of 7 days past complete clinical resolution.',
  },

  // ── Canine / Feline Ringworm ────────────────────────────────
  'Ringworm': {
    treatment: [
      'Topical antifungal therapy: Miconazole 2% / Chlorhexidine 2% medicated shampoo baths twice weekly',
      'Systemic oral antifungal (Itraconazole 5–10 mg/kg once daily) for 21–30 days',
      'Rigorous environmental decontamination: daily vacuuming and wipe hard surfaces with 0.5% sodium hypochlorite (1:10 bleach)',
      'Isolate patient from other household animals and young children',
    ],
    prescription: 'Itraconazole oral solution/capsules (dosed to body weight) SID with a meal for 28 days + Antifungal wash.',
    notes: 'Dermatophytosis is contagious and zoonotic. Owners must wear disposable gloves. Treatment continues until negative fungal culture.',
  },

  // ── Rabbit Mange ────────────────────────────────────────────
  'Rabbit Mange': {
    treatment: [
      'Topical Selamectin spot-on (Revolution for puppies/kittens, 6–18 mg/kg) or subcutaneous Ivermectin (0.2–0.4 mg/kg)',
      'Repeat dosing at 14-day intervals for 2–3 treatments',
      'Do NOT forcefully pick or peel ear crusts — allow crusts to slough off naturally to prevent auditory canal hemorrhage',
      'Sanitize hutch, cage, litter box, and accessories with hot soapy water or safe veterinary disinfectant',
    ],
    prescription: 'Selamectin spot-on (dosed to body weight) applied topically between shoulder blades; repeat in 14 days.',
    notes: 'Psoroptes cuniculi (ear mites) causes severe pain and crusting. Isolate from other rabbits until mite scraping confirms cure.',
  },
  'Mange (Rabbit)': {
    treatment: [
      'Topical Selamectin spot-on (Revolution for puppies/kittens, 6–18 mg/kg) or subcutaneous Ivermectin (0.2–0.4 mg/kg)',
      'Repeat dosing at 14-day intervals for 2–3 treatments',
      'Do NOT forcefully pick or peel ear crusts — allow crusts to slough off naturally to prevent auditory canal hemorrhage',
      'Sanitize hutch, cage, litter box, and accessories with hot soapy water or safe veterinary disinfectant',
    ],
    prescription: 'Selamectin spot-on (dosed to body weight) applied topically between shoulder blades; repeat in 14 days.',
    notes: 'Psoroptes cuniculi (ear mites) causes severe pain and crusting. Isolate from other rabbits until mite scraping confirms cure.',
  },

  // ── Rabbit Ringworm ─────────────────────────────────────────
  'Rabbit Ringworm': {
    treatment: [
      'Topical antifungal ointment (Miconazole 1% or Clotrimazole 1%) applied twice daily for 2–4 weeks',
      'Thorough cage & bedding disinfection to eliminate fungal arthrospores',
      'Consider oral antifungal (Terbinafine 10–20 mg/kg or Itraconazole 5–10 mg/kg) if lesions are generalized',
      'Schedule follow-up evaluation and skin scrapings in 14 days',
    ],
    prescription: 'Dispense 30 g Miconazole 1% topical ointment. Apply thin layer around margin of lesion BID for 21 days.',
    notes: 'Dermatophytosis (ringworm) is zoonotic. Owners should wear disposable gloves during topical applications.',
  },
  'Ringworm (Rabbit)': {
    treatment: [
      'Topical antifungal ointment (Miconazole 1% or Clotrimazole 1%) applied twice daily for 2–4 weeks',
      'Thorough cage & bedding disinfection to eliminate fungal arthrospores',
      'Consider oral antifungal (Terbinafine 10–20 mg/kg or Itraconazole 5–10 mg/kg) if lesions are generalized',
      'Schedule follow-up evaluation and skin scrapings in 14 days',
    ],
    prescription: 'Dispense 30 g Miconazole 1% topical ointment. Apply thin layer around margin of lesion BID for 21 days.',
    notes: 'Dermatophytosis (ringworm) is zoonotic. Owners should wear disposable gloves during topical applications.',
  },

  // ── Rabbit Healthy ──────────────────────────────────────────
  'Rabbit_Healthy': {
    treatment: [
      'Patient is dermatologically healthy. Fur coat intact, no alopecia, crusting, or ectoparasites observed.',
      'No medical or pharmacological treatment indicated.',
      'Maintain standard high-fiber hay diet (unlimited Timothy hay), fresh water, and clean dry bedding.',
    ],
    prescription: 'None required (Patient is healthy).',
    notes: 'Routine health check documented. Return for biannual rabbit wellness exam.',
  },
  'Healthy (Rabbit)': {
    treatment: [
      'Patient is dermatologically healthy. Fur coat intact, no alopecia, crusting, or ectoparasites observed.',
      'No medical or pharmacological treatment indicated.',
      'Maintain standard high-fiber hay diet (unlimited Timothy hay), fresh water, and clean dry bedding.',
    ],
    prescription: 'None required (Patient is healthy).',
    notes: 'Routine health check documented. Return for biannual rabbit wellness exam.',
  },
}

export default function Treatment({ onBack, caseData }) {
  const patient            = caseData?.patient
  const consultation       = caseData?.consultation
  const aiResult           = caseData?.aiResult
  const diagnosis          = caseData?.approvedDiagnosis || caseData?.diagnosis || aiResult?.displayLabel || 'Ringworm'
  const secondaryDiagnosis  = caseData?.approvedSecondary || caseData?.secondaryDiagnosis || null
  const isComorbid         = Boolean(caseData?.isComorbid || secondaryDiagnosis)
  const isOverridden       = Boolean(caseData?.isOverridden)

  const primaryProtocol = TREATMENT_PROTOCOLS[diagnosis] ||
                         TREATMENT_PROTOCOLS[aiResult?.label] ||
                         (diagnosis.toLowerCase().includes('healthy') ? TREATMENT_PROTOCOLS['Healthy'] : {
    treatment: [
      'Topical dermatological therapy applied twice daily to affected region',
      'Anti-inflammatory or antimicrobial regimen based on clinical cytology',
      'Schedule follow-up evaluation in 7–10 days',
    ],
    prescription: 'Dispense prescribed medication with detailed dosage and administration schedule.',
    notes: 'Monitor lesion site daily. Discontinue medication and consult clinic if irritation develops.',
  })

  const secondaryProtocol = secondaryDiagnosis ? (
    TREATMENT_PROTOCOLS[secondaryDiagnosis] ||
    (secondaryDiagnosis.toLowerCase().includes('healthy') ? null : {
      treatment: [
        `Targeted adjunct therapy for concurrent ${secondaryDiagnosis}`,
        'Antimicrobial or antifungal wash twice weekly',
      ],
      prescription: `Adjunct therapy for concurrent ${secondaryDiagnosis}.`,
      notes: `Concurrent management for ${secondaryDiagnosis}.`,
    })
  ) : null

  // FR7: 60% Confidence Decision Boundary Rule (Thesis pp. 11, 41, 46, 56)
  const isSubThreshold = (aiResult?.confidence !== undefined && aiResult.confidence < 0.60) &&
                         !diagnosis.toLowerCase().includes('healthy') && !isOverridden

  let treatmentSteps = [...primaryProtocol.treatment]

  // Dual condition / Comorbidity steps
  if (isComorbid && secondaryProtocol) {
    treatmentSteps.push(`🩺 [CONCURRENT PROTOCOL: ${secondaryDiagnosis.toUpperCase()}] ${secondaryProtocol.treatment[0]}`)
    if (secondaryProtocol.treatment[1]) {
      treatmentSteps.push(`🩺 [ADJUNCT STEP] ${secondaryProtocol.treatment[1]}`)
    }
  }

  // Pharmacological contraindication alert if hot spots + ringworm
  const isHotSpotAndRingworm = (diagnosis.toLowerCase().includes('hot') && secondaryDiagnosis?.toLowerCase().includes('ringworm')) ||
                               (diagnosis.toLowerCase().includes('ringworm') && secondaryDiagnosis?.toLowerCase().includes('hot'))

  if (isHotSpotAndRingworm) {
    treatmentSteps.push(`⚠️ [STEROID CAUTION IN DUAL PRESENTATION] Betamethasone topical spray rapidly controls acute hot spot pain, but topical corticosteroids can exacerbate dermatophyte (Ringworm) proliferation. Taper steroid as soon as hot spot dries, and maintain continuous antifungal application.`)
  }

  if (isSubThreshold) {
    treatmentSteps.unshift('⚠️ [CONFIRMATORY LAB TESTING INDICATED] Pre-screening algorithmic confidence is below the 60% decision boundary. Attending veterinarian should execute secondary confirmatory diagnostics (microscopic skin scraping, fungal DTM culture, or tape cytology) to rule out differential conditions.')
  }

  // Initial combined prescription text
  let initialPrescription = primaryProtocol.prescription
  if (isComorbid && secondaryProtocol) {
    initialPrescription = `1. PRIMARY (${diagnosis.toUpperCase()}):\n${primaryProtocol.prescription}\n\n2. CONCURRENT (${secondaryDiagnosis.toUpperCase()}):\n${secondaryProtocol.prescription}`
  }

  // Initial combined notes text
  let initialNotes = primaryProtocol.notes
  if (isComorbid && secondaryProtocol) {
    initialNotes = `[COMORBIDITY MANAGEMENT: ${diagnosis} + ${secondaryDiagnosis}] ${primaryProtocol.notes} ${isHotSpotAndRingworm ? 'Caution with corticosteroid duration due to concurrent fungal infection.' : ''}`
  }
  if (isOverridden) {
    initialNotes = `[VETERINARIAN CLINICAL OVERRIDE]: Attending clinician modified diagnosis to ${diagnosis}${caseData?.overrideNotes ? `: "${caseData.overrideNotes}"` : '.'} ${initialNotes}`
  } else if (isSubThreshold) {
    initialNotes = `[FR7 Triage Notice]: AI pre-screening confidence was below the calibrated 60% decision boundary (${aiResult?.percent ?? '<60%'}). Secondary confirmatory laboratory diagnostics are advised. ${initialNotes}`
  }

  // Interactive Editable State for Veterinarian Customization
  const [prescription, setPrescription]   = useState(initialPrescription)
  const [clinicalNotes, setClinicalNotes] = useState(initialNotes)
  const [isSaving, setIsSaving]           = useState(false)
  const [saveMessage, setSaveMessage]     = useState('')
  const [saveError, setSaveError]         = useState('')

  const handleSaveTreatmentPlan = async () => {
    setIsSaving(true)
    setSaveMessage('')
    setSaveError('')
    try {
      if (consultation?.id) {
        await updateConsultation(consultation.id, {
          diagnosis,
          secondaryDiagnosis,
          isComorbid,
          treatmentPlan: prescription,
          clinicalNotes: clinicalNotes,
        })
      }
      setSaveMessage('✓ Treatment plan and customized prescription successfully saved to patient medical record!')
    } catch (err) {
      console.error('Failed to save treatment plan:', err)
      setSaveError('Could not save treatment plan to database. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const todayStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <>
      {/* ── Screen View: Interactive Treatment Plan ────────────────── */}
      <section className="treatment-card no-print">
        <div className="treatment-banner">
          <div className="treatment-banner-icon">✓</div>
          <div>
            <h2>Validated by Veterinarian</h2>
            <p>
              {patient ? `Patient: ${patient.name} (${patient.species}) • ` : ''}
              Treatment recommendation approved and ready for clinical execution.
            </p>
          </div>
        </div>

        {saveMessage && (
          <div style={{ padding: '12px 16px', background: '#dcfce7', border: '1px solid #86efac', color: '#166534', borderRadius: 10, fontWeight: 600, fontSize: '0.9rem' }}>
            {saveMessage}
          </div>
        )}

        {saveError && (
          <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: 10, fontWeight: 600, fontSize: '0.9rem' }}>
            {saveError}
          </div>
        )}

        <div className="treatment-panel">
          <div className="treatment-section treatment-highlight">
            <div className="treatment-section-title">VALIDATED DIAGNOSIS</div>
            <div className="treatment-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>
                  {diagnosis} {isOverridden ? '🔬 (Clinical Override)' : ''}
                </span>
                {aiResult?.percent && !isOverridden && (
                  <span style={{ fontSize: '0.9rem', color: '#16a34a', fontWeight: 'bold' }}>
                    AI Confidence: {aiResult.percent}
                  </span>
                )}
              </div>
              {isComorbid && secondaryDiagnosis && (
                <div style={{ padding: '6px 10px', background: '#dbeafe', borderRadius: 6, border: '1px solid #93c5fd', color: '#1e40af', fontSize: '0.85rem' }}>
                  🩺 <strong>Concurrent Co-Occurring Condition:</strong> {secondaryDiagnosis} (Secondary opportunistic infection)
                </div>
              )}
              {isOverridden && caseData?.overrideNotes && (
                <div style={{ padding: '6px 10px', background: '#fae8ff', borderRadius: 6, border: '1px solid #e879f9', color: '#701a75', fontSize: '0.85rem' }}>
                  🔬 <strong>Veterinarian Clinical Reason:</strong> {caseData.overrideNotes}
                </div>
              )}
            </div>
          </div>

          <div className="treatment-section">
            <div className="treatment-section-title">
              {isComorbid ? 'RECOMMENDED DUAL-CONDITION CARE PROTOCOL' : 'RECOMMENDED TREATMENT PROTOCOL (CLINICAL GUIDELINE)'}
            </div>
            <div className="treatment-section-body treatment-list">
              <ul>
                {treatmentSteps.map((step, idx) => (
                  <li key={idx} style={step.startsWith('⚠️') ? { color: '#b45309', fontWeight: 600, background: '#fef3c7', padding: '6px 10px', borderRadius: 4, listStyleType: 'none', marginLeft: -20, marginBottom: 8 } : {}}>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── Editable Prescription ───────────────────────────── */}
          <div className="treatment-section">
            <div className="treatment-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>PRESCRIPTION DETAILS (EDITABLE BY VET)</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal', textTransform: 'none' }}>
                ✏️ Customize medication & dosage as needed
              </span>
            </div>
            <div className="treatment-section-body">
              <textarea
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
                placeholder="Enter customized prescription, dosage, and administration schedule..."
              />
            </div>
          </div>

          {/* ── Editable Clinical Notes ─────────────────────────── */}
          <div className="treatment-section">
            <div className="treatment-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>VETERINARIAN CLINICAL NOTES (EDITABLE BY VET)</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal', textTransform: 'none' }}>
                ✏️ Add patient-specific precautions
              </span>
            </div>
            <div className="treatment-section-body">
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
                placeholder="Enter clinical notes, home care advice, or follow-up schedule..."
              />
            </div>
          </div>
        </div>

        {/* ── Action Buttons ──────────────────────────────────── */}
        <div className="treatment-footer" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
          <button className="secondary-btn small-back" type="button" onClick={onBack}>
            ← Back to Dashboard
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="secondary-btn"
              onClick={handlePrint}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
            >
              🖨️ Print Rx / Save PDF
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={handleSaveTreatmentPlan}
              disabled={isSaving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              💾 {isSaving ? 'Saving...' : 'Save & Finalize Treatment Plan'}
            </button>
          </div>
        </div>
      </section>

      {/* ── Print-Only Official Veterinary Prescription Slip ────────── */}
      <div className="print-slip" style={{ display: 'none' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: 12, marginBottom: 16 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.6rem', color: '#0f172a' }}>VETLINK ANIMAL CARE & HOSPITAL</h1>
          <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#475569' }}>Veterinary Clinical Decision Support System • Department of Dermatology</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Date: {todayStr} • Rx ID: {consultation?.id || 'CONS-1001'}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 16, fontSize: '0.9rem' }}>
          <div>
            <strong>Patient Name:</strong> {patient?.name || 'Unknown Patient'}<br />
            <strong>Species:</strong> {patient?.species || 'Canine'}<br />
            <strong>Patient ID:</strong> {patient?.id || 'P-1001'}
          </div>
          <div>
            <strong>Attending Clinician:</strong> Dr. Sarah Lin, DVM<br />
            <strong>Validated Diagnosis:</strong> <u>{diagnosis}</u>{isComorbid && secondaryDiagnosis ? ` + ${secondaryDiagnosis} (Concurrent)` : ''} {isOverridden ? '[Clinical Override]' : (aiResult?.percent ? `(${aiResult.percent})` : '')}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.2rem', margin: '0 0 6px', color: '#0f172a' }}>℞ PRESCRIPTION ORDER</h2>
          <div style={{ padding: 14, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.95rem', lineHeight: 1.6, minHeight: 80 }}>
            {prescription}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: '1rem', margin: '0 0 6px', color: '#0f172a' }}>CLINICAL & HOME CARE INSTRUCTIONS</h3>
          <div style={{ padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.88rem', lineHeight: 1.5 }}>
            {clinicalNotes}
          </div>
        </div>

        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 20 }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            System-generated CDSS Prescription.<br />
            Valid with attending veterinarian signature.
          </div>
          <div style={{ textAlign: 'center', width: 220 }}>
            <div style={{ borderBottom: '1px solid #0f172a', marginBottom: 6, height: 30 }}></div>
            <strong style={{ fontSize: '0.85rem' }}>Dr. Sarah Lin, DVM</strong><br />
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Lic. No. VET-894102</span>
          </div>
        </div>
      </div>
    </>
  )
}
