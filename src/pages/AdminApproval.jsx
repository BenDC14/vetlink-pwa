import { useState } from 'react'
import { updateConsultation } from '../db/database'
import { checkComorbidity, checkEarlyStageDifferential } from './NewPatient'

const SPECIES_DIAGNOSES = {
  Canine: [
    'Healthy',
    'Hot Spots',
    'Mange',
    'Pyoderma',
    'Ringworm',
  ],
  Feline: [
    'Healthy',
    'Hot Spots',
    'Mange',
    'Pyoderma',
    'Ringworm',
  ],
  Rabbit: [
    'Rabbit Healthy',
    'Rabbit Mange',
    'Rabbit Ringworm',
  ],
  Avian: [
    'Bird Healthy',
    'Avian Fowl Pox',
    'Scaly Face Scaly Leg Mite (Knemidocoptes)',
  ],
}

export default function AdminApproval({ onBack, onApprove, caseData }) {
  // caseData is passed from App.jsx after NewPatient saves successfully
  // Shape: { patient, consultation, aiResult, previewUrl }
  const patient      = caseData?.patient
  const consultation = caseData?.consultation
  const aiResult     = caseData?.aiResult
  const preview      = caseData?.previewUrl

  // Comorbidity check
  const comorb = checkComorbidity(aiResult?.top3)
  const earlyDiff = checkEarlyStageDifferential(aiResult, patient?.species, patient?.areaOfConcern)
  const [includePrimary, setIncludePrimary]     = useState(true)
  const [includeSecondary, setIncludeSecondary] = useState(Boolean(comorb.isComorbid))

  // Early-stage / Clinical Diagnostic Override State
  const [overrideDiagnosis, setOverrideDiagnosis] = useState('')
  const [overrideNotes, setOverrideNotes]         = useState('')
  const [showOverridePanel, setShowOverridePanel] = useState(false)
  const [isSaving, setIsSaving]                   = useState(false)

  // Confidence color
  const conf = aiResult?.confidence ?? 0
  const confColor = conf >= 0.8 ? '#22c55e' : conf >= 0.5 ? '#f59e0b' : '#ef4444'
  const confLabel = conf >= 0.8 ? 'High' : conf >= 0.5 ? 'Moderate' : 'Low'

  return (
    <section className="admin-approval-card">
      <div className="admin-approval-header dark">
        <div>
          <p className="eyebrow">Admin Approval</p>
          <h2>Review AI Result</h2>
        </div>
        <button className="secondary-btn small-back" type="button" onClick={onBack}>← DASHBOARD</button>
      </div>

      {/* Patient info strip */}
      {patient && (
        <div style={{
          padding: '10px 20px',
          background: '#f0f4ff',
          borderBottom: '1px solid #dde3f0',
          display: 'flex',
          gap: 24,
          fontSize: '0.88rem',
          color: '#334',
        }}>
          <span><strong>Patient:</strong> {patient.name}</span>
          <span><strong>ID:</strong> {patient.id}</span>
          <span><strong>Species:</strong> {patient.species}</span>
          {patient.areaOfConcern && (
            <span><strong>Area:</strong> {patient.areaOfConcern}</span>
          )}
        </div>
      )}

      {/* 3-Panel Grad-CAM Visual Explainability (Pages 40-41 of Capstone Paper) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, padding: 16, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div className="approval-panel">
          <div className="approval-panel-title" style={{ fontWeight: 'bold', fontSize: '0.82rem', marginBottom: 6, color: '#334155' }}>
            1. Original Image
          </div>
          {aiResult?.gradcam?.originalUrl || preview ? (
            <img
              src={aiResult?.gradcam?.originalUrl || preview}
              alt="Original Image"
              style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 6, border: '1px solid #cbd5e1' }}
            />
          ) : (
            <div className="approval-preview">No image</div>
          )}
        </div>

        <div className="approval-panel">
          <div className="approval-panel-title" style={{ fontWeight: 'bold', fontSize: '0.82rem', marginBottom: 6, color: '#334155' }}>
            2. Heatmap (Jet Colormap)
          </div>
          {aiResult?.gradcam?.heatmapUrl ? (
            <img
              src={aiResult.gradcam.heatmapUrl}
              alt="AI Heatmap"
              style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 6, border: '1px solid #cbd5e1' }}
            />
          ) : (
            <div className="approval-preview">Heatmap unavailable</div>
          )}
        </div>

        <div className="approval-panel">
          <div className="approval-panel-title" style={{ fontWeight: 'bold', fontSize: '0.82rem', marginBottom: 6, color: '#334155' }}>
            3. Grad-CAM Overlay
          </div>
          {aiResult?.gradcam?.overlayUrl ? (
            <img
              src={aiResult.gradcam.overlayUrl}
              alt="Grad-CAM Overlay"
              style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 6, border: '1px solid #cbd5e1' }}
            />
          ) : (
            <div className="approval-preview">Overlay unavailable</div>
          )}
        </div>
      </div>

      {/* AI Analysis */}
      <div className="ai-analysis-card">
        <div className="ai-analysis-title">AI Analysis</div>

        <div className="analysis-row">
          <span>Diagnosis</span>
          <strong>{aiResult?.displayLabel ?? 'N/A'}</strong>
        </div>

        <div className="analysis-row">
          <span>Confidence</span>
          <strong style={{ color: confColor }}>
            {aiResult?.percent ?? 'N/A'} ({confLabel})
          </strong>
        </div>

        <div className="analysis-row">
          <span>Decision Boundary (60%)</span>
          {conf >= 0.60 ? (
            <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '0.85rem' }}>
              ✓ &ge; 60% (First-Line Care Protocol Auto-Drafted)
            </span>
          ) : (
            <span style={{ color: '#d97706', fontWeight: 'bold', fontSize: '0.85rem' }}>
              ⚠️ &lt; 60% (Secondary Lab Testing Recommended)
            </span>
          )}
        </div>

        <div className="analysis-row">
          <span>Summary</span>
          <span style={{ textAlign: 'right', fontSize: '0.85rem', maxWidth: '60%' }}>
            {aiResult?.description ?? '—'}
          </span>
        </div>

        {/* Top 3 breakdown */}
        {aiResult?.top3 && (
          <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 10 }}>
            <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: 6 }}>Top 3 predictions:</p>
            {aiResult.top3.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: '0.82rem', color: '#555', width: 160 }}>
                  {i + 1}. {item.display}
                </span>
                <div style={{
                  flex: 1,
                  height: 6,
                  background: '#e5e7eb',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${(item.confidence * 100).toFixed(1)}%`,
                    height: '100%',
                    background: i === 0 ? '#3b82f6' : '#93c5fd',
                    borderRadius: 4,
                  }} />
                </div>
                <span style={{ fontSize: '0.8rem', color: '#777', width: 40, textAlign: 'right' }}>
                  {(item.confidence * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin decision */}
      <div className="decision-card">
        <div className="decision-header">Admin decision required</div>
        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 12 }}>
          Review the AI result above. Approve to generate a treatment recommendation,
          or reject if the result appears incorrect.
        </p>

        {conf < 0.60 && !aiResult?.displayLabel?.toLowerCase().includes('healthy') && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef3c7', borderLeft: '4px solid #f59e0b', borderRadius: 4, fontSize: '0.82rem', color: '#92400e' }}>
            <strong>Triage Protocol Notice (FR7):</strong> AI confidence is below the 60% decision boundary. Secondary confirmatory diagnostics (skin scraping, fungal culture, or cytology) are recommended prior to initiating first-line therapy.
          </div>
        )}

        {/* Comorbidity / Dual-presentation notice & Checkboxes */}
        {comorb.isComorbid && !overrideDiagnosis && (
          <div style={{ marginBottom: 14, padding: '12px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '4px solid #3b82f6', borderRadius: 8 }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.88rem', color: '#1e40af', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🩺</span>
              <span>Suspected Mixed / Co-Occurring Dermatitis</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#334155', margin: '0 0 10px', lineHeight: 1.4 }}>
              Simultaneous visual indicators detected for both conditions. Select which diagnoses to confirm into the treatment protocol:
            </p>
            <div style={{ display: 'grid', gap: 6, fontSize: '0.84rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 10px', background: includePrimary ? '#dbeafe' : '#f8fafc', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                <input
                  type="checkbox"
                  checked={includePrimary}
                  onChange={(e) => setIncludePrimary(e.target.checked)}
                />
                <span><strong>Primary Condition:</strong> {comorb.primary} ({(comorb.primaryConf * 100).toFixed(1)}%)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 10px', background: includeSecondary ? '#e0e7ff' : '#f8fafc', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                <input
                  type="checkbox"
                  checked={includeSecondary}
                  onChange={(e) => setIncludeSecondary(e.target.checked)}
                />
                <span><strong>Concurrent Secondary:</strong> {comorb.secondary} ({(comorb.secondaryConf * 100).toFixed(1)}%) — <em>Secondary opportunistic dermatitis</em></span>
              </label>
            </div>
          </div>
        )}

        {/* Early-Stage Subclinical / Facial Differential Advisory */}
        {earlyDiff && !overrideDiagnosis && (
          <div style={{ marginBottom: 14, padding: '12px 14px', background: 'rgba(168, 85, 247, 0.12)', border: '1px solid #c084fc', borderLeft: '4px solid #a855f7', borderRadius: 8 }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.88rem', color: '#6b21a8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🔬</span>
              <span>{earlyDiff.title}</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#3b0764', margin: '0 0 8px', lineHeight: 1.45 }}>
              {earlyDiff.message}
            </p>
            <div style={{ fontSize: '0.78rem', color: '#7e22ce', fontWeight: 600 }}>
              💡 <em>{earlyDiff.overrideHint}</em>
            </div>
          </div>
        )}

        {/* Veterinarian Clinical Override / Early-Stage Adjustment */}
        <div style={{ marginBottom: 14, padding: '12px 14px', background: '#fdf4ff', border: '1px solid #f5d0fe', borderLeft: '4px solid #c026d3', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.88rem', color: '#86198f', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🔬</span>
              <span>Clinical Diagnostic Adjustment / Early-Stage Override</span>
            </span>
            <button
              type="button"
              className="secondary-btn"
              style={{ fontSize: '0.74rem', padding: '3px 8px' }}
              onClick={() => setShowOverridePanel(!showOverridePanel)}
            >
              {showOverridePanel ? 'Hide Options ▲' : 'Adjust Diagnosis ▼'}
            </button>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#4a044e', margin: '0 0 8px', lineHeight: 1.35 }}>
            Did the AI classify an early-stage lesion as "Healthy" (e.g. early Mange with subtle erythema)? As attending veterinarian, you may override the AI pre-screening below.
          </p>

          {showOverridePanel && (
            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              <label style={{ fontSize: '0.8rem', color: '#701a75' }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Select Verified Clinical Diagnosis:</span>
                <select
                  value={overrideDiagnosis}
                  onChange={(e) => setOverrideDiagnosis(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d946ef', fontSize: '0.85rem' }}
                >
                  <option value="">-- Use AI Pre-Screening Result ({aiResult?.displayLabel}) --</option>
                  {(SPECIES_DIAGNOSES[patient?.species || 'Canine'] || SPECIES_DIAGNOSES.Canine).map((diag) => (
                    <option key={diag} value={diag}>
                      {diag} {diag.toLowerCase() === 'mange' ? '(e.g. Early / Subclinical Mange)' : ''}
                    </option>
                  ))}
                </select>
              </label>

              {overrideDiagnosis && (
                <label style={{ fontSize: '0.8rem', color: '#701a75' }}>
                  <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Clinical Reason / Observation Notes:</span>
                  <input
                    type="text"
                    value={overrideNotes}
                    onChange={(e) => setOverrideNotes(e.target.value)}
                    placeholder="e.g. Early-stage focal erythema on muzzle margin; confirmed by clinical scraping."
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d946ef', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </label>
              )}
            </div>
          )}

          {overrideDiagnosis && (
            <div style={{ marginTop: 8, padding: '6px 8px', background: '#fae8ff', border: '1px solid #e879f9', borderRadius: 6, fontSize: '0.78rem', color: '#701a75' }}>
              ✓ <strong>Active Clinical Override:</strong> Will prescribe care protocol for <strong>{overrideDiagnosis}</strong> instead of {aiResult?.displayLabel}.
            </div>
          )}
        </div>

        <button
          className="capture-btn approve-btn"
          type="button"
          disabled={isSaving}
          onClick={async () => {
            setIsSaving(true)
            const isOverridden = Boolean(overrideDiagnosis)
            const finalPrimary = isOverridden
              ? overrideDiagnosis
              : (includePrimary ? (aiResult?.displayLabel || 'Healthy') : (comorb.secondary || 'Healthy'))
            const finalSecondary = (!isOverridden && includePrimary && includeSecondary && comorb.isComorbid)
              ? comorb.secondary
              : null
            const isComorbidActive = Boolean(finalSecondary)

            if (consultation?.id) {
              try {
                await updateConsultation(consultation.id, {
                  diagnosis: finalPrimary,
                  secondaryDiagnosis: finalSecondary,
                  isComorbid: isComorbidActive,
                  reviewStatus: 'approved',
                  isOverridden,
                  overrideNotes: isOverridden ? overrideNotes || 'Adjusted based on clinical veterinary examination' : null,
                })
              } catch (err) {
                console.warn('Could not update consultation in database:', err)
              }
            }

            setIsSaving(false)
            onApprove({
              approvedDiagnosis: finalPrimary,
              approvedSecondary: finalSecondary,
              isComorbid: isComorbidActive,
              isOverridden,
              overrideNotes,
            })
          }}
        >
          {isSaving ? '⏳ Saving Consultation...' : '✓ Approve & Generate Treatment'}
        </button>
        <button className="secondary-btn reject-btn" type="button" onClick={onBack} disabled={isSaving}>
          ✗ Reject Result
        </button>
      </div>
    </section>
  )
}
