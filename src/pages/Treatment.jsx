const TREATMENT_PROTOCOLS = {
  'Rabbit Ringworm': {
    treatment: [
      'Topical antifungal cream (Miconazole or Clotrimazole 1%) applied twice daily for 2–4 weeks',
      'Thorough cage & bedding disinfection to eliminate fungal spores (zoonotic protection)',
      'Consider oral antifungal (Terbinafine or Itraconazole) if lesions become generalized',
      'Follow-up evaluation and skin scrapings scheduled in 14 days',
    ],
    prescription: 'Dispense 30 g Miconazole 1% topical ointment. Apply thin layer around margin of lesion BID.',
    notes: 'Warn owners that dermatophytosis (ringworm) is zoonotic. Wear disposable gloves during topical applications.',
  },
  'Ringworm (Rabbit)': {
    treatment: [
      'Topical antifungal cream (Miconazole or Clotrimazole 1%) applied twice daily for 2–4 weeks',
      'Thorough cage & bedding disinfection to eliminate fungal spores (zoonotic protection)',
      'Consider oral antifungal (Terbinafine or Itraconazole) if lesions become generalized',
      'Follow-up evaluation and skin scrapings scheduled in 14 days',
    ],
    prescription: 'Dispense 30 g Miconazole 1% topical ointment. Apply thin layer around margin of lesion BID.',
    notes: 'Warn owners that dermatophytosis (ringworm) is zoonotic. Wear disposable gloves during topical applications.',
  },
  'Rabbit Mange': {
    treatment: [
      'Subcutaneous Ivermectin (0.2–0.4 mg/kg) or topical Selamectin (Revolution)',
      'Repeat dosing at 14-day intervals for 2–3 treatments',
      'Clean and sanitize hutch/cage environment with acaricidal solution',
    ],
    prescription: 'Selamectin spot-on (15 mg/kg single topical application), repeat in 14 days.',
    notes: 'Isolate from other rabbits until mite scraping confirms resolution.',
  },
  'Rabbit_Healthy': {
    treatment: [
      'No medical treatment indicated. Patient skin and coat integrity normal.',
      'Maintain standard hygiene, hay-based diet, and routine preventative checkups.',
    ],
    prescription: 'None required.',
    notes: 'Routine health check documented. Return for biannual wellness exam.',
  },
  'Pyoderma': {
    treatment: [
      'Topical chlorhexidine 2–4% antibacterial shampoo or spray',
      'Oral systemic antibiotics (Cephalexin or Amoxicillin-Clavulanate) for 14–21 days if deep',
      'Identify and address underlying allergies, ectoparasites, or endocrine disorders',
    ],
    prescription: 'Cephalexin 22 mg/kg PO BID for 14 days + Chlorhexidine 3% flush.',
    notes: 'Recheck cytology in 2 weeks. Continue treatment 7 days past clinical resolution.',
  },
  'Ringworm': {
    treatment: [
      'Topical antifungal therapy (Lime sulfur dip or Miconazole/Chlorhexidine bath)',
      'Oral Itraconazole 5–10 mg/kg once daily for 21–30 days',
      'Rigorous environmental vacuuming and 0.5% sodium hypochlorite surface disinfection',
    ],
    prescription: 'Itraconazole 100 mg capsules (compounded to patient weight) + topical antifungal wash.',
    notes: 'Fungal culture or Wood lamp check recommended at week 3 and 4.',
  },
}

export default function Treatment({ onBack, caseData }) {
  const patient   = caseData?.patient
  const aiResult  = caseData?.aiResult
  const diagnosis = aiResult?.displayLabel || 'Ringworm (Rabbit)'

  const protocol = TREATMENT_PROTOCOLS[diagnosis] ||
                   TREATMENT_PROTOCOLS[aiResult?.label] || {
    treatment: [
      'Topical dermatological therapy applied twice daily to affected region',
      'Anti-inflammatory or antimicrobial regimen based on clinical cytology',
      'Schedule follow-up evaluation in 7–10 days',
    ],
    prescription: 'Dispense prescribed medication with detailed dosage and administration schedule.',
    notes: 'Monitor lesion site daily. Discontinue medication and consult clinic if irritation develops.',
  }

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
              {protocol.treatment.map((step, idx) => (
                <li key={idx}>{step}</li>
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
            {protocol.notes}
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
