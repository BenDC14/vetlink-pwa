import { useState, useEffect, useRef, useMemo } from 'react'
import {
  getPendingSyncQueue,
  getSyncConflicts,
  getFailedSyncItems,
  getPatients,
} from '../db/database'

export default function NotificationPopover({
  isOpen,
  onClose,
  currentUser,
  pendingSyncCount,
  lastSyncTime,
  onNavigate,
  onUnreadCountChange,
}) {
  const [filter, setFilter] = useState('all') // 'all' | 'sync' | 'clinical'
  const [readIds, setReadIds] = useState(() => {
    try {
      const stored = localStorage.getItem('vetlink_read_notifications')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const stored = localStorage.getItem('vetlink_dismissed_notifications')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const [conflicts, setConflicts] = useState([])
  const [failedSyncs, setFailedSyncs] = useState([])
  const [activePatients, setActivePatients] = useState([])
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  const popoverRef = useRef(null)

  // Listen to connectivity & queue updates
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Fetch contextual database state when opened or queue changes
  const fetchNotificationData = async () => {
    try {
      const [conflictList, failedList, patientList] = await Promise.all([
        getSyncConflicts().catch(() => []),
        getFailedSyncItems().catch(() => []),
        getPatients().catch(() => []),
      ])
      setConflicts(conflictList || [])
      setFailedSyncs(failedList || [])

      // Filter patients with pending sync or recently created/modified within 3 days
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const recent = (patientList || []).filter(
        (p) => p.syncStatus === 'pending' || (p.updatedAt && p.updatedAt > threeDaysAgo)
      )
      setActivePatients(recent.slice(0, 5))
    } catch (err) {
      console.warn('Could not refresh notification data:', err)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchNotificationData()
    }
  }, [isOpen, pendingSyncCount])

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        // Check if click was on the trigger button itself
        const trigger = event.target.closest('.notification-btn')
        if (!trigger) {
          onClose()
        }
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Compute active notification items
  const allNotifications = useMemo(() => {
    const list = []

    // 1. Sync Conflicts (Urgent Action Required)
    if (conflicts.length > 0) {
      list.push({
        id: `conflict-${conflicts.length}-${conflicts[0]?.id || 'list'}`,
        category: 'sync',
        severity: 'danger',
        title: `Sync Conflict Detected (${conflicts.length})`,
        message: `${conflicts.length} record${conflicts.length > 1 ? 's have' : ' has'} conflicting cloud and local versions. Tap to resolve.`,
        timestamp: 'Requires Action',
        actionLabel: 'Resolve in Sync',
        onAction: () => {
          onNavigate('sync')
          onClose()
        },
      })
    }

    // 2. Failed Sync Items
    if (failedSyncs.length > 0) {
      list.push({
        id: `failed-sync-${failedSyncs.length}`,
        category: 'sync',
        severity: 'danger',
        title: `Sync Push Failed (${failedSyncs.length})`,
        message: `${failedSyncs.length} item${failedSyncs.length > 1 ? 's' : ''} exceeded retry attempts. Tap to review errors.`,
        timestamp: 'Attention Needed',
        actionLabel: 'View Queue',
        onAction: () => {
          onNavigate('sync')
          onClose()
        },
      })
    }

    // 3. Pending Offline Records
    if (pendingSyncCount > 0) {
      list.push({
        id: `pending-sync-${pendingSyncCount}`,
        category: 'sync',
        severity: 'warning',
        title: `Pending Cloud Sync (${pendingSyncCount})`,
        message: `${pendingSyncCount} record${pendingSyncCount > 1 ? 's are' : ' is'} stored locally on this device. Syncs automatically when online.`,
        timestamp: isOnline ? 'Syncing...' : 'Saved Offline',
        actionLabel: 'View Sync',
        onAction: () => {
          onNavigate('sync')
          onClose()
        },
      })
    }

    // 4. Offline Working State
    if (!isOnline) {
      list.push({
        id: 'system-offline-banner',
        category: 'system',
        severity: 'info',
        title: 'Working in Offline Mode',
        message: 'Network is disconnected. Full intake, AI analysis history, and prescriptions remain 100% active locally.',
        timestamp: 'Active',
        actionLabel: null,
        onAction: null,
      })
    }

    // 5. Active Clinical Patients
    activePatients.forEach((patient) => {
      const isPending = patient.syncStatus === 'pending'
      list.push({
        id: `patient-active-${patient.id}`,
        category: 'clinical',
        severity: isPending ? 'warning' : 'success',
        title: `Patient: ${patient.name || 'Unnamed'} (${patient.species || 'Canine'})`,
        message: patient.areaOfConcern
          ? `Condition: ${patient.areaOfConcern}`
          : `Owner: ${patient.ownerName || 'Walk-in'} • Last visit recorded`,
        timestamp: patient.updatedAt ? new Date(patient.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recent',
        actionLabel: 'Open Patient',
        onAction: () => {
          onNavigate('patients', { patientId: patient.id })
          onClose()
        },
      })
    })

    // 6. Healthy Synced State (Only if no warnings/sync pending)
    if (isOnline && pendingSyncCount === 0 && conflicts.length === 0 && failedSyncs.length === 0) {
      list.push({
        id: 'system-all-synced',
        category: 'system',
        severity: 'success',
        title: 'All Clinical Records Synchronized',
        message: `Local database is up to date with the clinic cloud${lastSyncTime ? ` (last verified ${lastSyncTime})` : ''}.`,
        timestamp: lastSyncTime || 'Synced',
        actionLabel: 'Sync Hub',
        onAction: () => {
          onNavigate('sync')
          onClose()
        },
      })
    }

    return list.filter((item) => !dismissedIds.includes(item.id))
  }, [conflicts, failedSyncs, pendingSyncCount, isOnline, activePatients, lastSyncTime, dismissedIds, onNavigate, onClose])

  // Compute unread count
  const unreadCount = useMemo(() => {
    return allNotifications.filter((n) => !readIds.includes(n.id)).length
  }, [allNotifications, readIds])

  // Sync unread count to parent header icon
  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(unreadCount)
    }
  }, [unreadCount, onUnreadCountChange])

  // Mark all as read
  const handleMarkAllRead = () => {
    const allIds = allNotifications.map((n) => n.id)
    const updated = Array.from(new Set([...readIds, ...allIds]))
    setReadIds(updated)
    try {
      localStorage.setItem('vetlink_read_notifications', JSON.stringify(updated))
    } catch {
      // Ignore storage errors
    }
  }

  // Dismiss a single notification
  const handleDismiss = (e, id) => {
    e.stopPropagation()
    const updated = [...dismissedIds, id]
    setDismissedIds(updated)
    try {
      localStorage.setItem('vetlink_dismissed_notifications', JSON.stringify(updated))
    } catch {
      // Ignore storage errors
    }
  }

  // Filter list
  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return allNotifications
    return allNotifications.filter((n) => n.category === filter)
  }, [allNotifications, filter])

  if (!isOpen) return null

  return (
    <div
      ref={popoverRef}
      className="notification-popover"
      role="dialog"
      aria-label="Notifications and Alerts"
    >
      {/* Header */}
      <div className="notification-popover-header">
        <div className="notification-header-left">
          <div className="notification-popover-title">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="notification-unread-pill">{unreadCount} new</span>
            )}
          </div>
          <span className="notification-popover-sub">
            Clinic activity, sync status & clinical care
          </span>
        </div>
        <div className="notification-header-right">
          {unreadCount > 0 && (
            <button
              type="button"
              className="notification-mark-all-btn"
              onClick={handleMarkAllRead}
              title="Mark all notifications as read"
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            className="notification-close-btn"
            onClick={onClose}
            aria-label="Close notifications"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="notification-tabs">
        <button
          type="button"
          className={`notification-tab-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({allNotifications.length})
        </button>
        <button
          type="button"
          className={`notification-tab-btn ${filter === 'sync' ? 'active' : ''}`}
          onClick={() => setFilter('sync')}
        >
          Sync
        </button>
        <button
          type="button"
          className={`notification-tab-btn ${filter === 'clinical' ? 'active' : ''}`}
          onClick={() => setFilter('clinical')}
        >
          Clinical
        </button>
      </div>

      {/* Scrollable Notification List */}
      <div className="notification-list-scroll">
        {filteredNotifications.length === 0 ? (
          <div className="notification-empty-state">
            <div className="notification-empty-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="notification-empty-title">All Caught Up</div>
            <p className="notification-empty-desc">
              {filter === 'all'
                ? 'No pending sync conflicts, unread clinical alerts, or offline issues.'
                : `No active notifications in the ${filter} category.`}
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const isUnread = !readIds.includes(item.id)
            return (
              <div
                key={item.id}
                className={`notification-item ${item.severity} ${isUnread ? 'unread' : 'read'} ${item.onAction ? 'clickable' : ''}`}
                onClick={() => {
                  if (item.onAction) {
                    if (isUnread) {
                      const updated = Array.from(new Set([...readIds, item.id]))
                      setReadIds(updated)
                      try {
                        localStorage.setItem('vetlink_read_notifications', JSON.stringify(updated))
                      } catch {
                        // ignore
                      }
                    }
                    item.onAction()
                  }
                }}
              >
                {/* Status Icon */}
                <div className={`notification-icon-wrap ${item.severity}`}>
                  {item.category === 'sync' && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                  )}
                  {item.category === 'clinical' && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  )}
                  {item.category === 'system' && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  )}
                </div>

                {/* Body Content */}
                <div className="notification-content">
                  <div className="notification-item-top">
                    <span className="notification-item-title">{item.title}</span>
                    <button
                      type="button"
                      className="notification-dismiss-btn"
                      onClick={(e) => handleDismiss(e, item.id)}
                      title="Dismiss notification"
                      aria-label="Dismiss notification"
                    >
                      ×
                    </button>
                  </div>
                  <p className="notification-item-msg">{item.message}</p>
                  <div className="notification-item-footer">
                    <span className="notification-item-time">{item.timestamp}</span>
                    {item.actionLabel && (
                      <span className="notification-item-action-link">
                        {item.actionLabel} &rarr;
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer Navigation Bar */}
      <div className="notification-popover-footer">
        <button
          type="button"
          className="notification-footer-btn"
          onClick={() => {
            onNavigate('sync')
            onClose()
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          Sync Manager
        </button>
        {currentUser?.role === 'Clinic Admin' && (
          <button
            type="button"
            className="notification-footer-btn"
            onClick={() => {
              onNavigate('audit')
              onClose()
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Audit Trail
          </button>
        )}
      </div>
    </div>
  )
}
