export default function PendingApprovals() {
  return (
    <section className="pending-card">
      <div className="pending-banner">3 RESULTS AWAITING APPROVAL FROM STAFF DEVICES</div>

      {[1, 2].map((i) => (
        <div key={i} className="approval-item">
          <div className="approval-header">AI-00{i} <span style={{ marginLeft: 12, color: 'var(--muted)' }}>from Staff {i} • PWA-00{i}</span></div>
          <div className="approval-body">
            <div className="approval-col placeholder">ORIGINAL</div>
            <div className="approval-col placeholder">AI HEATMAP</div>
            <div className="approval-col result-panel">
              <div className="result-box">
                <h4>Dermatitis</h4>
                <p>Confidence: 82%</p>
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="action-btn blue">✓ APPROVE</button>
                <button className="small-outline danger">✗ REJECT</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </section>
  )
}