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
  const patient   = caseData?.patient
  const aiResult  = caseData?.aiResult
  const diagnosis = aiResult?.displayLabel || 'Ringworm (Rabbit)'

  const protocol = TREATMENT_PROTOCOLS[diagnosis] ||
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

  // FR7: 60% Confidence Decision Boundary Rule (Thesis pp. 11, 41, 46, 56)
  const isSubThreshold = (aiResult?.confidence !== undefined && aiResult.confidence < 0.60) &&
                         !diagnosis.toLowerCase().includes('healthy')

  // Comorbidity / Dual-Presentation Check
  const isComorbid = aiResult?.top3?.length > 1 &&
                     aiResult.top3[1].confidence >= 0.25 &&
                     (aiResult.top3[0].confidence - aiResult.top3[1].confidence) <= 0.40 &&
                     !aiResult.top3[0].display.toLowerCase().includes('healthy') &&
                     !aiResult.top3[1].display.toLowerCase().includes('healthy')

  let treatmentSteps = [...protocol.treatment]

  if (isComorbid) {
    treatmentSteps.push(`🩺 [COMORBIDITY CONSIDERATION] Strong secondary differential detected for ${aiResult.top3[1].display} (${(aiResult.top3[1].confidence * 100).toFixed(1)}%). If active lesions are multifocal or show secondary inflammation/crusting, consider adjunct topical antiseptic therapy (e.g. Chlorhexidine wash) alongside primary ${diagnosis} management.`)
  }

  if (isSubThreshold) {
    treatmentSteps.unshift('⚠️ [CONFIRMATORY LAB TESTING INDICATED] Pre-screening algorithmic confidence is below the 60% decision boundary. Attending veterinarian should execute secondary confirmatory diagnostics (microscopic skin scraping, fungal DTM culture, or tape cytology) to rule out differential conditions.')
  }

  const clinicalNotes = isSubThreshold
    ? `[FR7 Triage Notice] AI pre-screening confidence was below the calibrated 60% decision boundary (${aiResult?.percent ?? '<60%'}). Secondary confirmatory laboratory diagnostics are advised. ${protocol.notes}`
    : protocol.notes

  return (
    <section className="treatment-card">
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

      <div className="treatment-panel">
        <div className="treatment-section treatment-highlight">
          <div className="treatment-section-title">VALIDATED DIAGNOSIS</div>
          <div className="treatment-section-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>
              {diagnosis}
            </span>
            {aiResult?.percent && (
              <span style={{ fontSize: '0.9rem', color: '#16a34a', fontWeight: 'bold' }}>
                AI Confidence: {aiResult.percent}
              </span>
            )}
          </div>
        </div>

        <div className="treatment-section">
          <div className="treatment-section-title">RECOMMENDED TREATMENT PROTOCOL</div>
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

        <div className="treatment-section">
          <div className="treatment-section-title">PRESCRIPTION DETAILS</div>
          <div className="treatment-section-body">
            {protocol.prescription}
          </div>
        </div>

        <div className="treatment-section">
          <div className="treatment-section-title">VETERINARIAN CLINICAL NOTES</div>
          <div className="treatment-section-body">
            {clinicalNotes}
          </div>
        </div>
      </div>

      <div className="treatment-footer">
        <button className="secondary-btn small-back" type="button" onClick={onBack}>
          ← Back to Dashboard
        </button>
      </div>
    </section>
  )
}
