import { useState } from 'react'
import { addPatient } from '../db/database'

export default function NewPatient({ onBack, onViewPending, onCapture }) {
  const [patientId, setPatientId] = useState('')
  const [name, setName] = useState('')
  const [species, setSpecies] = useState('Canine')
  const [areaOfConcern, setAreaOfConcern] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCapture = async () => {
    if (!patientId.trim() || !name.trim()) {
      setError('Patient ID and name are required.')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      await addPatient({
        id: patientId.trim(),
        name: name.trim(),
        species,
        areaOfConcern: areaOfConcern.trim(),
        lastVisit: new Date().toISOString().slice(0, 10),
        status: 'Active',
      })
      onCapture()
    } catch (saveError) {
      console.error('Failed to save patient:', saveError)
      setError('Unable to save this patient locally.')
    } finally {
      setIsSaving(false)
    }
  }

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
              <input value={patientId} onChange={(event) => setPatientId(event.target.value)} placeholder="PT-1001" />
            </label>
            <label>
              <span>PATIENT NAME</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Buddy" />
            </label>
            <label>
              <span>SPECIES</span>
              <select value={species} onChange={(event) => setSpecies(event.target.value)}>
                <option>Canine</option>
                <option>Feline</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              <span>AREA OF CONCERN</span>
              <input value={areaOfConcern} onChange={(event) => setAreaOfConcern(event.target.value)} placeholder="Back leg rash" />
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="form-actions-row">
              <button className="capture-btn" type="button" onClick={handleCapture} disabled={isSaving}>
                <span>📷</span>
                {isSaving ? 'SAVING...' : 'CAPTURE & RUN AI'}
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
