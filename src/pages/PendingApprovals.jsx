import { useCallback, useEffect, useState } from 'react'

export default function PendingApprovals({ authToken, apiBaseUrl = 'http://localhost:8000' }) {
  const [patients, setPatients] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadPatients = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) setIsRefreshing(true)

    try {
      const response = await fetch(`${apiBaseUrl}/api/patients`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || `Unable to load patients (HTTP ${response.status})`)

      setPatients(result.patients || [])
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'Unable to load patient records from the database.')
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
                    <span className="status-badge">{patient.status || 'Active'}</span>
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