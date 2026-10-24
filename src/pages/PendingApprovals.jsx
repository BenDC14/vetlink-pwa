import { useCallback, useEffect, useState } from 'react'
import { getPatients } from '../db/database'

function renderBadge(status) {
  const norm = (status || 'Active').toLowerCase()
  if (norm.includes('awaiting lab') || norm.includes('lab test')) {
    return <span className="status-badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 600 }}>🧪 Awaiting Lab Test</span>
  }
  if (norm.includes('needs vet') || (norm.includes('review') && norm.includes('needs'))) {
    return <span className="status-badge" style={{ background: '#fef9c3', color: '#854d0e', border: '1px solid #fef08a', fontWeight: 600 }}>🟡 Needs Vet Review</span>
  }
  if (norm.includes('review results') || norm.includes('review')) {
    return <span className="status-badge" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac', fontWeight: 600 }}>🟢 Review Results</span>
  }
  if (norm.includes('completed') || norm.includes('discharged')) {
    return <span className="status-badge" style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', fontWeight: 600 }}>✅ Completed</span>
  }
  return <span className="status-badge">{status || 'Active'}</span>
}

export default function PendingApprovals({ authToken, apiBaseUrl = 'http://localhost:8000' }) {
  const [patients, setPatients] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadPatients = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) setIsRefreshing(true)

    try {
      if (authToken) {
        const response = await fetch(`${apiBaseUrl}/api/patients`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        const result = await response.json()
        if (response.ok && result.patients) {
          setPatients(result.patients)
          setError('')
          return
        }
      }
      // Offline fallback: load local IndexedDB patients
      const localPatients = await getPatients()
      setPatients(localPatients || [])
      setError('')
    } catch {
      try {
        const localPatients = await getPatients()
        setPatients(localPatients || [])
        setError('')
      } catch (localErr) {
        setError(localErr.message || 'Unable to load patient records from local or cloud database.')
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [apiBaseUrl, authToken])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => loadPatients(), 0)
    const intervalId = window.setInterval(() => loadPatients(), 15000)
    return () => {
      window.clearTimeout(initialRefresh)
      window.clearInterval(intervalId)
    }
  }, [loadPatients])

  return (
    <section className="pending-card">
      <header className="pending-list-header">
        <div>
          <p className="eyebrow">Pending Approval</p>
          <h3>Patient submissions</h3>
          <p className="pending-description">Patient records received from staff devices and saved in the clinic database.</p>
        </div>
        <button
          className="secondary-btn pending-refresh"
          type="button"
          onClick={() => loadPatients(true)}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {error && <div className="alert-banner error" role="alert">{error}</div>}

      {isLoading ? (
        <p className="pending-state" role="status">Loading patient submissions...</p>
      ) : patients.length === 0 ? (
        <p className="pending-state">No patient records have been uploaded to the database yet.</p>
      ) : (
        <>
          <p className="pending-count" role="status">{patients.length} patient {patients.length === 1 ? 'record' : 'records'} in the database</p>
          <div className="pending-record-list">
            {patients.map((patient) => {
              const createdAt = patient.created_at || patient.createdAt
              const lastVisit = patient.last_visit || patient.lastVisit
              const creator = patient.created_by || patient.createdBy

              return (
                <article className="pending-record" key={patient.id}>
                  <header className="pending-record-header">
                    <div>
                      <h4>{patient.name || 'Unnamed patient'}</h4>
                      <p>{patient.id}</p>
                    </div>
                    {renderBadge(patient.status)}
                  </header>
                  <dl className="pending-record-details">
                    <div>
                      <dt>Species</dt>
                      <dd>{patient.species || 'Not specified'}</dd>
                    </div>
                    <div>
                      <dt>Area of concern</dt>
                      <dd>{patient.area_of_concern || patient.areaOfConcern || 'Not provided'}</dd>
                    </div>
                    <div>
                      <dt>Last visit</dt>
                      <dd>{lastVisit ? new Date(lastVisit).toLocaleDateString() : 'Not provided'}</dd>
                    </div>
                    <div>
                      <dt>Submitted</dt>
                      <dd>{createdAt ? new Date(createdAt).toLocaleString() : 'Date unavailable'}</dd>
                    </div>
                    <div>
                      <dt>Staff account</dt>
                      <dd>{creator || 'Not recorded'}</dd>
                    </div>
                  </dl>
                </article>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}