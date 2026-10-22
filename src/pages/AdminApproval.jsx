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

      {/* Image panels */}
      <div className="approval-grid">
        <div className="approval-panel">
          <div className="approval-panel-title">Captured Photo</div>
          {preview ? (
            <img
              src={preview}
              alt="Captured pet photo"
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }}
            />
          ) : (
            <div className="approval-preview">No image captured</div>
          )}
        </div>
        <div className="approval-panel">
          <div className="approval-panel-title">AI Heatmap</div>
          <div className="approval-preview heatmap" style={{ fontSize: '0.85rem', color: '#888', textAlign: 'center' }}>
            Grad-CAM visualization<br />
            <span style={{ fontSize: '0.75rem' }}>(coming in next phase)</span>
          </div>
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
