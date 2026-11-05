import { useState, useEffect } from 'react'
import { getAuditLogs } from '../db/database'

export default function AuditLogs({ currentUser, authToken, apiBaseUrl = 'http://localhost:8000', isOffline }) {
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('All')
  const [errorMessage, setErrorMessage] = useState('')

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const localLogs = await getAuditLogs()
      setLogs(localLogs)

      // If online, fetch cloud audit logs and merge
      if (!isOffline && authToken) {
        try {
          const res = await fetch(`${apiBaseUrl}/api/audit-logs`, {
            headers: { Authorization: `Bearer ${authToken}` },
          })
          if (res.ok) {
            const data = await res.json()
            if (data.logs && data.logs.length > 0) {
              // Combine and deduplicate by id
              const logMap = new Map()
              localLogs.forEach((l) => logMap.set(l.id, l))
              data.logs.forEach((l) => logMap.set(l.id, l))
              const combined = Array.from(logMap.values()).sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
              )
              setLogs(combined)
            }
          }
        } catch (cloudErr) {
          console.warn('[AuditLogs] Cloud audit log fetch failed:', cloudErr)
        }
      }
    } catch (err) {
      console.error('[AuditLogs] Failed to fetch logs:', err)
      setErrorMessage('Could not load audit logs from local storage.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [authToken, apiBaseUrl, isOffline])

  const actionCategories = [
    'All',
    'PATIENT_ADMITTED',
    'PATIENT_EDITED',
    'PATIENT_ARCHIVED',
    'PATIENT_RESTORED',
    'TREATMENT_FINALIZED',
    'VET_RECHECK_SAVED',
    'STAFF_TRIAGE_INTAKE',
    'STAFF_REMOVED',
  ]

  const getActionBadge = (action) => {
    const act = (action || '').toUpperCase()
    if (act.includes('ADMITTED') || act.includes('FINALIZED') || act.includes('RESTORED')) {
      return (
        <span style={{
          fontSize: '0.74rem',
          padding: '3px 8px',
          borderRadius: 4,
          fontWeight: 700,
          background: '#dcfce7',
          color: '#166534',
          border: '1px solid #86efac'
        }}>
          {action}
        </span>
      )
    }
    if (act.includes('EDIT') || act.includes('TRIAGE') || act.includes('RECHECK')) {
      return (
        <span style={{
          fontSize: '0.74rem',
          padding: '3px 8px',
          borderRadius: 4,
          fontWeight: 700,
          background: '#fef3c7',
          color: '#92400e',
          border: '1px solid #fde68a'
        }}>
          {action}
        </span>
      )
    }
    if (act.includes('ARCHIVE') || act.includes('DELETE') || act.includes('REMOVED')) {
      return (
        <span style={{
          fontSize: '0.74rem',
          padding: '3px 8px',
          borderRadius: 4,
          fontWeight: 700,
          background: '#fee2e2',
          color: '#991b1b',
          border: '1px solid #fca5a5'
        }}>
          {action}
        </span>
      )
    }
    return (
      <span style={{
        fontSize: '0.74rem',
        padding: '3px 8px',
        borderRadius: 4,
        fontWeight: 700,
        background: '#e0f2fe',
        color: '#075985',
        border: '1px solid #bae6fd'
      }}>
        {action}
      </span>
    )
  }

  const filteredLogs = logs.filter((log) => {
    const q = searchTerm.toLowerCase().trim()
    const matchesSearch =
      !q ||
      String(log.action || '').toLowerCase().includes(q) ||
      String(log.userName || '').toLowerCase().includes(q) ||
      String(log.userRole || '').toLowerCase().includes(q) ||
      String(log.targetId || '').toLowerCase().includes(q) ||
      String(log.details || '').toLowerCase().includes(q)

    const matchesAction = actionFilter === 'All' || log.action === actionFilter
    return matchesSearch && matchesAction
  })

  return (
    <section className="patients-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>
            Clinic Audit Trail & System Activity
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
            Chronological compliance record of clinical consultations, admissions, and administrative operations.
          </p>
        </div>
        <button
          type="button"
          className="secondary-btn"
          onClick={fetchLogs}
          disabled={isLoading}
          style={{ fontSize: '0.82rem', padding: '6px 14px' }}
        >
          {isLoading ? 'Refreshing...' : 'Refresh Logs'}
        </button>
      </div>

      {errorMessage && (
        <div className="alert-banner error" style={{ marginBottom: 14 }}>
          {errorMessage}
        </div>
      )}

      {/* Action Category Filter Pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {actionCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`filter-pill ${actionFilter === cat ? 'active' : ''}`}
            onClick={() => setActionFilter(cat)}
            style={{ fontSize: '0.78rem', padding: '4px 10px' }}
          >
            {cat === 'All' ? 'All Activity' : cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          className="search-input"
          placeholder="Search audit trail by user, patient ID, diagnosis, or keyword..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
        />
      </div>

      {/* Audit Log Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="patients-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 150 }}>TIMESTAMP</th>
              <th style={{ width: 140 }}>ACTION</th>
              <th style={{ width: 160 }}>PERFORMED BY</th>
              <th style={{ width: 120 }}>TARGET</th>
              <th>DETAILS & CLINICAL CONTEXT</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
                  Loading system activity logs...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>
                  No system activity logs found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Recent'}
                  </td>
                  <td>
                    {getActionBadge(log.action)}
                  </td>
                  <td>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a' }}>
                      {log.userName || 'System'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      {log.userRole || 'Staff'} {log.userId ? `(${log.userId})` : ''}
                    </div>
                  </td>
                  <td>
                    {log.targetId ? (
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0369a1', background: '#f0f9ff', padding: '2px 6px', borderRadius: 4, border: '1px solid #bae6fd' }}>
                        {log.targetId}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.4 }}>
                    {log.details || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

