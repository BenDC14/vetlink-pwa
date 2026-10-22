import { useEffect, useState, useRef } from 'react'
import {
  getPatients,
  updatePatient,
  addConsultation,
  getConsultationsByPatient,
  addScreeningResult,
  getScreeningResultsByConsultation
} from '../db/database'

export default function Patients() {
  const [patients, setPatients] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [editingPatient, setEditingPatient] = useState(null)
  const [formData, setFormData] = useState({ name: '', species: 'Canine', areaOfConcern: '', lastVisit: '', status: 'Active' })
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Recheck / Follow-up Visit State
  const [recheckPatient, setRecheckPatient]             = useState(null)
  const [pastConsult, setPastConsult]                   = useState(null)
  const [pastScreening, setPastScreening]               = useState(null)
  const [recheckProgress, setRecheckProgress]           = useState('improving')
  const [recheckNotes, setRecheckNotes]                 = useState('')
  const [recheckFile, setRecheckFile]                   = useState(null)
  const [recheckPreview, setRecheckPreview]             = useState(null)
  const [isSavingRecheck, setIsSavingRecheck]           = useState(false)
  const [recheckError, setRecheckError]                 = useState('')
  const recheckInputRef                                 = useRef(null)

  const refreshPatients = async () => {
    const savedPatients = await getPatients()
    setPatients(savedPatients)
  }

  useEffect(() => {
    let isMounted = true

    getPatients()
      .then((savedPatients) => {
        if (isMounted) {
          setPatients(savedPatients)
        }
      })
      .catch((error) => console.error('Failed to load patients:', error))
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const visiblePatients = patients.filter((patient) => {
    const query = searchTerm.toLowerCase()
    return patient.id.toLowerCase().includes(query) || patient.name.toLowerCase().includes(query)
  })

  const openEditPatient = (patient) => {
    setEditingPatient(patient)
    setFormError('')
    setFormData({
      name: patient.name || '',
      species: patient.species || 'Canine',
      areaOfConcern: patient.areaOfConcern || '',
      lastVisit: patient.lastVisit || '',
      status: patient.status || 'Active',
    })
  }

  const handleSavePatient = async (event) => {
    event.preventDefault()
    if (!formData.name.trim()) {
      setFormError('Patient name is required.')
      return
    }

    setIsSaving(true)
    setFormError('')
    try {
      await updatePatient(editingPatient.id, {
        ...formData,
        name: formData.name.trim(),
        areaOfConcern: formData.areaOfConcern.trim(),
      })
      await refreshPatients()
      setEditingPatient(null)
      setSuccessMessage(`${formData.name.trim()} was updated and queued for sync.`)
    } catch (error) {
      console.error('Failed to update patient:', error)
      setFormError(error.message || 'Could not save patient changes.')
    } finally {
      setIsSaving(false)
    }
  }

  const openRecheckModal = async (patient) => {
    setRecheckPatient(patient)
    setRecheckError('')
    setRecheckProgress('improving')
    setRecheckNotes('')
    setRecheckFile(null)
    setRecheckPreview(null)
    setPastConsult(null)
    setPastScreening(null)

    try {
      const consults = await getConsultationsByPatient(patient.id)
      if (consults && consults.length > 0) {
        const latest = consults[consults.length - 1]
        setPastConsult(latest)
        const screenings = await getScreeningResultsByConsultation(latest.id)
        if (screenings && screenings.length > 0) {
          setPastScreening(screenings[screenings.length - 1])
        }
      }
    } catch (err) {
      console.warn('Could not load past consultations:', err)
    }
  }

  const handleRecheckFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRecheckFile(file)
    if (recheckPreview) URL.revokeObjectURL(recheckPreview)
    setRecheckPreview(URL.createObjectURL(file))
  }

  const handleSaveRecheck = async (e) => {
    e.preventDefault()
    if (!recheckPatient) return
    setIsSavingRecheck(true)
    setRecheckError('')

    try {
      const today = new Date().toISOString().slice(0, 10)
      let b64Img = null
      if (recheckFile) {
        b64Img = await new Promise((res, rej) => {
          const r = new FileReader()
          r.onload = () => res(r.result)
          r.onerror = rej
          r.readAsDataURL(recheckFile)
        })
      }

      const progressLabels = {
        resolved: 'Resolved / Fully Healed',
        improving: 'Responding / Improving',
        unchanged: 'Refractory / Unchanged',
        new_complication: 'Suspected New Complication',
      }

      // 1. Add follow-up consultation record
      const newConsult = await addConsultation({
        patientId: recheckPatient.id,
        clinicalNotes: `[Recheck Evaluation: ${progressLabels[recheckProgress] || recheckProgress}] ${recheckNotes.trim()}`,
        diagnosis: recheckProgress === 'resolved'
          ? 'Healthy (Resolved)'
          : `Follow-up: ${pastConsult?.diagnosis || recheckPatient.areaOfConcern || 'Cutaneous Lesion'} (${progressLabels[recheckProgress]})`,
        treatmentPlan: recheckProgress === 'resolved'
          ? 'Clinical discharge. Lesion resolved; resume routine preventive care.'
          : `Continued regimen: ${pastConsult?.treatmentPlan || 'Maintain ongoing therapy; recheck in 14 days.'}`,
      })

      // 2. Add screening result if recheck image provided
      if (b64Img) {
        await addScreeningResult({
          consultationId: newConsult.id,
          imageData: b64Img,
          aiLabel: recheckProgress === 'resolved' ? 'Healthy' : (pastConsult?.diagnosis || 'Lesion'),
          aiDisplayLabel: recheckProgress === 'resolved' ? 'Healthy (Resolved)' : `Recheck: ${progressLabels[recheckProgress]}`,
          aiConfidence: 0.95,
          aiPercent: 'Clinical Review',
          species: recheckPatient.species,
          reviewStatus: 'approved',
        })
      }

      // 3. Update patient's lastVisit and status
      await updatePatient(recheckPatient.id, {
        lastVisit: today,
        status: recheckProgress === 'resolved' ? 'Discharged' : 'Active',
      })

      await refreshPatients()
      setSuccessMessage(`✓ Follow-up recheck consultation successfully saved for ${recheckPatient.name}!`)
      setRecheckPatient(null)
    } catch (err) {
      console.error('Failed to save recheck:', err)
      setRecheckError(err.message || 'Could not save recheck consultation.')
    } finally {
      setIsSavingRecheck(false)
    }
  }

  return (
    <section className="patients-card">
      <div className="patients-header">
        <div className="patients-search">
          <label className="eyebrow">Search Patient</label>
          <div className="search-row">
            <input className="search-input" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by patient name or ID" />
            <button className="search-btn" type="button">SEARCH</button>
          </div>
        </div>
      </div>

      <div className="patients-table-wrap">
        {successMessage && <div className="alert-banner success" role="status">{successMessage}</div>}
        <table className="patients-table">
          <thead>
            <tr>
              <th>PATIENT ID</th>
              <th>NAME</th>
              <th>SPECIES</th>
              <th>LAST VISIT</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="6">Loading patients...</td></tr>
            ) : visiblePatients.length === 0 ? (
              <tr><td colSpan="6">No patients saved yet.</td></tr>
            ) : visiblePatients.map((patient) => (
              <tr key={patient.id}>
                <td>{patient.id}</td>
                <td><strong>{patient.name}</strong></td>
                <td>{patient.species}</td>
                <td>{patient.lastVisit}</td>
                <td><span className="status-badge">{patient.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="small-outline" type="button" onClick={() => openEditPatient(patient)}>
                      EDIT
                    </button>
                    <button
                      className="secondary-btn"
                      style={{ padding: '6px 12px', fontSize: '0.78rem', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', fontWeight: 600 }}
                      type="button"
                      onClick={() => openRecheckModal(patient)}
                    >
                      🩺 RECHECK
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingPatient && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-patient-title">
          <div className="modal-dialog">
            <header className="modal-header">
              <h3 id="edit-patient-title">Edit Patient Record</h3>
              <button className="modal-close-btn" type="button" onClick={() => setEditingPatient(null)} aria-label="Close edit patient dialog">✕</button>
            </header>
            <form className="modal-form" onSubmit={handleSavePatient}>
              {formError && <div className="alert-banner error" role="alert">{formError}</div>}
              <label>
                <span>Patient ID</span>
                <input value={editingPatient.id} readOnly />
              </label>
              <label>
                <span>Name</span>
                <input value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} required />
              </label>
              <label>
                <span>Species</span>
                <select value={formData.species} onChange={(event) => setFormData({ ...formData, species: event.target.value })}>
                  <option>Canine</option>
                  <option>Feline</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                <span>Area of Concern</span>
                <input value={formData.areaOfConcern} onChange={(event) => setFormData({ ...formData, areaOfConcern: event.target.value })} />
              </label>
              <label>
                <span>Last Visit</span>
                <input type="date" value={formData.lastVisit} onChange={(event) => setFormData({ ...formData, lastVisit: event.target.value })} />
              </label>
              <label>
                <span>Status</span>
                <select value={formData.status} onChange={(event) => setFormData({ ...formData, status: event.target.value })}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </label>
              <div className="modal-actions">
                <button className="small-outline" type="button" onClick={() => setEditingPatient(null)} disabled={isSaving}>Cancel</button>
                <button className="action-btn blue" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {recheckPatient && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="recheck-patient-title">
          <div className="modal-dialog" style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
            <header className="modal-header">
              <h3 id="recheck-patient-title">
                🩺 Follow-Up Recheck: {recheckPatient.name} ({recheckPatient.species})
              </h3>
              <button className="modal-close-btn" type="button" onClick={() => setRecheckPatient(null)} aria-label="Close dialog">✕</button>
            </header>

            <form className="modal-form" onSubmit={handleSaveRecheck}>
              {recheckError && <div className="alert-banner error" role="alert">{recheckError}</div>}

              {/* Side-by-Side Comparison Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
                
                {/* Baseline (Visit 1) */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: 12, background: '#f8fafc' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.82rem', color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>
                    1. Baseline (Visit 1)
                  </div>
                  {pastScreening?.imageData ? (
                    <img
                      src={pastScreening.imageData}
                      alt="Baseline lesion"
                      style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid #cbd5e1' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: 160, background: '#e2e8f0', borderRadius: 8, display: 'grid', placeItems: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                      No prior photo saved
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: '0.82rem', color: '#334155', lineHeight: 1.4 }}>
                    <strong>Prior Diagnosis:</strong> {pastConsult?.diagnosis || recheckPatient.areaOfConcern || 'Cutaneous check'}<br />
                    <strong>Date:</strong> {pastConsult?.createdAt?.slice(0, 10) || recheckPatient.lastVisit || 'Initial Visit'}
                  </div>
                </div>

                {/* Recheck (Visit 2 - Today) */}
                <div style={{ border: '1px solid #86efac', borderRadius: 12, padding: 12, background: '#f0fdf4' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.82rem', color: '#166534', marginBottom: 8, textTransform: 'uppercase' }}>
                    2. Today's Recheck Photo
                  </div>
                  {recheckPreview ? (
                    <div>
                      <img
                        src={recheckPreview}
                        alt="Today's recheck lesion"
                        style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid #86efac' }}
                      />
                      <button
                        type="button"
                        className="secondary-btn"
                        style={{ marginTop: 6, width: '100%', padding: '4px 8px', fontSize: '0.78rem' }}
                        onClick={() => recheckInputRef.current?.click()}
                      >
                        🔄 Retake Today's Photo
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: 160,
                        border: '2px dashed #86efac',
                        borderRadius: 8,
                        display: 'grid',
                        placeItems: 'center',
                        color: '#166534',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        background: 'white',
                      }}
                      onClick={() => recheckInputRef.current?.click()}
                    >
                      📷 Snap / Upload Today's Photo
                    </div>
                  )}
                  <input
                    type="file"
                    ref={recheckInputRef}
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={handleRecheckFileChange}
                  />
                  <div style={{ marginTop: 8, fontSize: '0.82rem', color: '#166534' }}>
                    Recheck Date: <strong>{new Date().toISOString().slice(0, 10)}</strong>
                  </div>
                </div>
              </div>

              {/* Clinical Progress Selector */}
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#1e293b', display: 'block', marginBottom: 6 }}>
                  Veterinarian Healing Stage Evaluation:
                </span>
                <div style={{ display: 'grid', gap: 6, fontSize: '0.85rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 10px', background: recheckProgress === 'resolved' ? '#dcfce7' : '#f8fafc', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                    <input
                      type="radio"
                      name="progress"
                      value="resolved"
                      checked={recheckProgress === 'resolved'}
                      onChange={(e) => setRecheckProgress(e.target.value)}
                    />
                    <span>🟢 <strong>Resolved / Fully Healed</strong> — Lesion cleared, fur regrown, no active erythema</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 10px', background: recheckProgress === 'improving' ? '#fef9c3' : '#f8fafc', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                    <input
                      type="radio"
                      name="progress"
                      value="improving"
                      checked={recheckProgress === 'improving'}
                      onChange={(e) => setRecheckProgress(e.target.value)}
                    />
                    <span>🟡 <strong>Responding / Improving</strong> — Lesion reduced by ~50–80%, healthy scabbing present</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 10px', background: recheckProgress === 'unchanged' ? '#fee2e2' : '#f8fafc', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                    <input
                      type="radio"
                      name="progress"
                      value="unchanged"
                      checked={recheckProgress === 'unchanged'}
                      onChange={(e) => setRecheckProgress(e.target.value)}
                    />
                    <span>🔴 <strong>Refractory / Unchanged</strong> — No clinical response; alternative medication indicated</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 10px', background: recheckProgress === 'new_complication' ? '#f3e8ff' : '#f8fafc', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                    <input
                      type="radio"
                      name="progress"
                      value="new_complication"
                      checked={recheckProgress === 'new_complication'}
                      onChange={(e) => setRecheckProgress(e.target.value)}
                    />
                    <span>🟣 <strong>Suspected New Complication</strong> — Secondary infection or new separate lesion detected</span>
                  </label>
                </div>
              </div>

              {/* Clinical Notes */}
              <label>
                <span>Follow-Up Clinical Notes</span>
                <textarea
                  value={recheckNotes}
                  onChange={(e) => setRecheckNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Day 14 Recheck: Pruritus subsided, 70% hair regrowth on flank. Tapering shampoo to once weekly..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </label>

              <div className="modal-actions" style={{ marginTop: 14 }}>
                <button className="small-outline" type="button" onClick={() => setRecheckPatient(null)} disabled={isSavingRecheck}>Cancel</button>
                <button className="primary-btn" type="submit" disabled={isSavingRecheck}>
                  {isSavingRecheck ? 'Saving...' : '💾 Save Follow-Up Recheck'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
