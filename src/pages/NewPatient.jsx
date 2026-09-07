export default function NewPatient({ onBack, onViewPending, onCapture }) {
  return (
    <section className="new-patient-card">
      <div className="new-patient-header">
        <button className="secondary-btn small-back" type="button" onClick={onBack}>← DASHBOARD</button>
        <span className="status-chip green">ONLINE</span>
      </div>

      <div className="new-patient-topbar">
        <div>
          <div className="brand-badge">ADMIN PWA</div>
          <p>Full Access</p>
        </div>
      </div>

      <div className="new-patient-main">
        <div className="new-patient-preview">
          <div className="image-placeholder">Patient capture preview</div>
        </div>

        <div className="new-patient-form-card">
          <div className="form-card-heading">Patient Details</div>
          <div className="new-patient-form">
            <label>
              <span>PATIENT ID</span>
              <input placeholder="PT-1001" />
            </label>
            <label>
              <span>AREA OF CONCERN</span>
              <input placeholder="Back leg rash" />
            </label>
            <div className="form-actions-row">
              <button className="capture-btn" type="button" onClick={onCapture}>
                <span>📷</span>
                CAPTURE & RUN AI
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-access-card">
        <p className="eyebrow">Admin approval access</p>
        <p>Send this case for review after capture.</p>
        <button className="view-pending-btn" type="button" onClick={onViewPending}>VIEW PENDING APPROVALS (3)</button>
      </div>
    </section>
  )
}
