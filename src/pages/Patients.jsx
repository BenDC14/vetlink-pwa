import { useEffect, useState } from 'react'
import { getPatients, mergeCloudPatients, updatePatient } from '../db/database'

export default function Patients({ authToken, apiBaseUrl = 'http://localhost:8000', isOffline = false }) {
  const [patients, setPatients] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [cloudError, setCloudError] = useState('')
  const [editingPatient, setEditingPatient] = useState(null)
  const [formData, setFormData] = useState({ name: '', species: 'Canine', areaOfConcern: '', lastVisit: '', status: 'Active' })
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const refreshPatients = async () => {
    const savedPatients = await getPatients()
    setPatients(savedPatients)
  }

  useEffect(() => {
    let isMounted = true

    const loadPatients = async () => {
      try {
        const localPatients = await getPatients()
        if (isMounted) {
          setPatients(localPatients)
        }

        if (isOffline || !authToken) return

        const response = await fetch(`${apiBaseUrl}/api/patients`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.detail || `Patient request failed with HTTP ${response.status}`)

        await mergeCloudPatients(result.patients || [])
        const mergedPatients = await getPatients()
        if (isMounted) {
          setPatients(mergedPatients)
          setCloudError('')
        }
      } catch (error) {
        console.error('Failed to load cloud patients:', error)
        if (isMounted) setCloudError(error.message || 'Could not retrieve records from the cloud.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadPatients()

    return () => {
      isMounted = false
    }
  }, [apiBaseUrl, authToken, isOffline])

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
        {cloudError && (
          <div className="alert-banner error" role="alert">
            Cloud records could not be loaded: {cloudError} Showing records saved on this device.
          </div>
        )}
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
                  <button className="small-outline" type="button" onClick={() => openEditPatient(patient)}>
                    EDIT
                  </button>
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
    </section>
  )
}
