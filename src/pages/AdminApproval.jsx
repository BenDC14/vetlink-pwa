export default function AdminApproval({ onBack, onApprove, caseData }) {
  // caseData is passed from App.jsx after NewPatient saves successfully
  // Shape: { patient, consultation, aiResult, previewUrl }
  const patient  = caseData?.patient
  const aiResult = caseData?.aiResult
  const preview  = caseData?.previewUrl

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

        {/* Comorbidity / Dual-presentation notice for veterinarian review */}
        {aiResult?.top3?.length > 1 &&
         aiResult.top3[1].confidence >= 0.25 &&
         (aiResult.top3[0].confidence - aiResult.top3[1].confidence) <= 0.40 &&
         !aiResult.top3[0].display.toLowerCase().includes('healthy') &&
         !aiResult.top3[1].display.toLowerCase().includes('healthy') && (
          <div style={{ marginBottom: 12, padding: '10px 12px', background: '#eff6ff', borderLeft: '4px solid #3b82f6', borderRadius: 4, fontSize: '0.82rem', color: '#1e40af' }}>
            <strong>🩺 Suspected Mixed / Co-Occurring Infection:</strong> Simultaneous visual patterns detected for both <strong>{aiResult.top3[0].display} ({(aiResult.top3[0].confidence * 100).toFixed(1)}%)</strong> and <strong>{aiResult.top3[1].display} ({(aiResult.top3[1].confidence * 100).toFixed(1)}%)</strong>. Secondary bacterial dermatitis frequently co-occurs with mite infestations due to self-trauma.
          </div>
        )}
        <button className="capture-btn approve-btn" type="button" onClick={onApprove}>
          ✓ Approve &amp; Generate Treatment
        </button>
        <button className="secondary-btn reject-btn" type="button" onClick={onBack}>
          ✗ Reject Result
        </button>
      </div>
    </section>
  )
}
