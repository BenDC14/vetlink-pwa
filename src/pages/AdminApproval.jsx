export default function AdminApproval({ onBack, onApprove }) {
  return (
    <section className="admin-approval-card">
      <div className="admin-approval-header dark">
        <div>
          <p className="eyebrow">Admin Approval</p>
          <h2>Review AI Result</h2>
        </div>
        <button className="secondary-btn small-back" type="button" onClick={onBack}>← DASHBOARD</button>
      </div>

      <div className="approval-grid">
        <div className="approval-panel">
          <div className="approval-panel-title">Original</div>
          <div className="approval-preview">Capture preview</div>
        </div>
        <div className="approval-panel">
          <div className="approval-panel-title">AI Heatmap</div>
          <div className="approval-preview heatmap">Heatmap result</div>
        </div>
      </div>

      <div className="ai-analysis-card">
        <div className="ai-analysis-title">AI Analysis</div>
        <div className="analysis-row">
          <span>Diagnosis</span>
          <strong>Dermatitis</strong>
        </div>
        <div className="analysis-row">
          <span>Confidence</span>
          <strong>82%</strong>
        </div>
        <div className="analysis-row">
          <span>Affected Area</span>
          <strong>~12 cm²</strong>
        </div>
      </div>

      <div className="decision-card">
        <div className="decision-header">Admin decision required</div>
        <button className="capture-btn approve-btn" type="button" onClick={onApprove}>✓ Approve &amp; Generate Treatment</button>
        <button className="secondary-btn reject-btn" type="button">✗ Reject Result</button>
      </div>
    </section>
  )
}
