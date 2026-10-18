import { useState, useEffect } from 'react'
import { getPendingSyncQueue, performCloudSync } from '../db/database'

export default function Sync() {
  const [queue, setQueue] = useState([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [serverStatus, setServerStatus] = useState('checking') // checking, online, offline
  const [serverInfo, setServerInfo] = useState(null)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', message: string }
  const [lastSyncTime, setLastSyncTime] = useState(null)

  const refreshQueue = async () => {
    try {
      const items = await getPendingSyncQueue()
      setQueue(items || [])
    } catch (err) {
      console.error('Failed to read syncQueue from IndexedDB:', err)
    }
  }

  const checkServerHealth = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/health', { method: 'GET' })
      if (res.ok) {
        const data = await res.json()
        setServerStatus('online')
        setServerInfo(data)
      } else {
        setServerStatus('offline')
      }
    } catch {
      setServerStatus('offline')
    }
  }

  useEffect(() => {
    refreshQueue()
    checkServerHealth()
    const interval = setInterval(() => {
      refreshQueue()
      checkServerHealth()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleManualSync = async () => {
    setIsSyncing(true)
    setFeedback(null)
    try {
      const result = await performCloudSync('http://localhost:8000')
      await refreshQueue()
      await checkServerHealth()
      setLastSyncTime(new Date().toLocaleTimeString())
      setFeedback({
        type: result.success ? 'success' : 'error',
        message: result.success
          ? result.message
          : `${result.message}${result.errors?.[0]?.error ? ` ${result.errors[0].error}` : ''}`,
      })
    } catch (err) {
      console.error('Manual sync failed:', err)
      setFeedback({
        type: 'error',
        message:
          serverStatus === 'offline'
            ? 'Cannot connect to backend server. Make sure "python backend/run.py" is running.'
            : `Sync failed: ${err.message}`,
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <section className="sync-card">
      <div className="sync-controls">
        <h3 className="eyebrow">Cloud Synchronization</h3>

        <div className="controls-row">
          <button
            className="action-btn blue"
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
          >
            {isSyncing ? '⏳ SYNCING...' : '▶ MANUAL SYNC'}
          </button>
          <button
            className="small-outline"
            type="button"
            onClick={() => {
              refreshQueue()
              checkServerHealth()
            }}
          >
            ↻ REFRESH
          </button>
        </div>

        {feedback && (
          <div
            className={`alert-banner ${feedback.type === 'success' ? 'success' : 'error'}`}
            style={{ marginTop: 12 }}
            role="status"
          >
            <span>{feedback.type === 'success' ? '✓ ' : '⚠ '}{feedback.message}</span>
            <button
              type="button"
              className="modal-close-btn"
              style={{ minHeight: 'auto', minWidth: 'auto', fontSize: '1rem' }}
              onClick={() => setFeedback(null)}
            >
              ✕
            </button>
          </div>
        )}

        <div className="sync-status">
          <div>
            Cloud Server:{' '}
            {serverStatus === 'checking' ? (
              <span className="status-badge gray">Checking...</span>
            ) : serverStatus === 'online' ? (
              <span className="status-badge">Online (MySQL Connected)</span>
            ) : (
              <span className="status-badge orange">Offline (Server on port 8000 unreachable)</span>
            )}
          </div>
          <div style={{ marginTop: 6, fontSize: '0.85rem', color: 'var(--muted)' }}>
            Pending offline items in queue: <strong>{queue.length}</strong>
            {lastSyncTime && <span style={{ marginLeft: 16 }}>Last synced: <strong>{lastSyncTime}</strong></span>}
            {serverInfo?.counts && (
              <span style={{ marginLeft: 16 }}>
                MySQL Cloud totals: <strong>{serverInfo.counts.users} staff</strong>, <strong>{serverInfo.counts.patients} patients</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <h4 style={{ marginBottom: 10, color: '#000' }}>Pending Sync Queue</h4>
        <div className="patients-table-wrap">
          <table className="patients-table staff-table">
            <thead>
              <tr>
                <th>QUEUE ID</th>
                <th>ENTITY TYPE</th>
                <th>ENTITY ID</th>
                <th>OPERATION</th>
                <th>STATUS</th>
                <th>CREATED AT</th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                    No local changes are waiting to be uploaded.
                  </td>
                </tr>
              ) : (
                queue.map((item) => (
                  <tr key={item.id}>
                    <td><code>{item.id.slice(0, 8)}...</code></td>
                    <td><strong>{item.entityType.toUpperCase()}</strong></td>
                    <td>{item.entityId}</td>
                    <td>
                      <span className={`status-badge ${item.operation === 'DELETE' ? 'orange' : ''}`}>
                        {item.operation}
                      </span>
                    </td>
                    <td><span className="sync-pending-tag">Pending</span></td>
                    <td style={{ fontSize: '0.85rem' }}>{item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : 'Just now'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
