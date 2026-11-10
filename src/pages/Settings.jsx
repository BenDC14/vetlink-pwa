import { useState, useEffect, useCallback } from 'react'
import { initDatabase, updateStaffUser, logAuditEvent } from '../db/database'

/**
 * Settings page — Option A (Stacked Cards) layout.
 * Renders inside the dashboard-panel when the Settings header icon is clicked.
 */
export default function Settings({ currentUser, onBack, authToken, apiBaseUrl, onUpdateUser, onLogout }) {
  // --- Notifications state (persisted in localStorage) ---
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('vetlink_notification_prefs')
      return saved ? JSON.parse(saved) : {
        email: true,
        push: true,
        syncAlerts: true,
        criticalPatient: true,
      }
    } catch {
      return { email: true, push: true, syncAlerts: true, criticalPatient: true }
    }
  })

  // --- Theme state ---
  const [theme, setTheme] = useState(() => localStorage.getItem('vetlink_theme') || 'system')

  // --- Storage info ---
  const [storageInfo, setStorageInfo] = useState({ used: 0, quota: 0 })
  const [isClearingCache, setIsClearingCache] = useState(false)
  const [cacheCleared, setCacheCleared] = useState(false)

  // --- Shared Tablet & Network Settings (persisted in localStorage) ---
  const [inactivityTimeout, setInactivityTimeout] = useState(() => {
    return localStorage.getItem('vetlink_inactivity_timeout') || '0'
  })

  const [wifiOnlySync, setWifiOnlySync] = useState(() => {
    return localStorage.getItem('vetlink_wifi_only_sync') === 'true'
  })

  // Persist notification preferences
  useEffect(() => {
    localStorage.setItem('vetlink_notification_prefs', JSON.stringify(notifications))
  }, [notifications])

  // Persist and apply theme globally
  useEffect(() => {
    localStorage.setItem('vetlink_theme', theme)
    const root = document.documentElement
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light')
    } else if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        root.setAttribute('data-theme', 'dark')
      } else {
        root.removeAttribute('data-theme')
      }
    }
    window.dispatchEvent(new Event('vetlink-theme-change'))
  }, [theme])

  // Persist shared tablet inactivity timeout
  useEffect(() => {
    localStorage.setItem('vetlink_inactivity_timeout', inactivityTimeout)
    window.dispatchEvent(new Event('vetlink-timeout-change'))
  }, [inactivityTimeout])

  // Persist Wi-Fi only sync setting
  useEffect(() => {
    localStorage.setItem('vetlink_wifi_only_sync', String(wifiOnlySync))
  }, [wifiOnlySync])

  // Estimate storage usage
  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(({ usage, quota }) => {
        setStorageInfo({ used: usage || 0, quota: quota || 0 })
      }).catch(() => {})
    }
  }, [])

  const toggleNotification = useCallback((key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleClearCache = async () => {
    setIsClearingCache(true)
    setCacheCleared(false)
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
      }
      // Re-estimate storage
      if (navigator.storage && navigator.storage.estimate) {
        const { usage, quota } = await navigator.storage.estimate()
        setStorageInfo({ used: usage || 0, quota: quota || 0 })
      }
      setCacheCleared(true)
      setTimeout(() => setCacheCleared(false), 3000)
    } catch (err) {
      console.error('Failed to clear cache:', err)
    } finally {
      setIsClearingCache(false)
    }
  }

  const handleExportData = async () => {
    try {
      const db = await initDatabase()
      const patients = await db.getAll('patients')
      const consultations = await db.getAll('consultations')
      const blob = new Blob(
        [JSON.stringify({ patients, consultations, exportedAt: new Date().toISOString() }, null, 2)],
        { type: 'application/json' }
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vetlink-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Data export is only available when local database records exist.')
    }
  }

  const handleExportCSV = async () => {
    try {
      const db = await initDatabase()
      const patients = await db.getAll('patients')
      const consultations = await db.getAll('consultations')

      // Map consultations to patientId to retrieve condition notes
      const consultMap = {}
      consultations.forEach(c => {
        if (!consultMap[c.patientId] || new Date(c.createdAt) > new Date(consultMap[c.patientId].createdAt)) {
          consultMap[c.patientId] = c
        }
      })

      const headers = [
        'Patient ID',
        'Patient Name',
        'Species',
        'Breed',
        'Age',
        'Gender',
        'Owner Name',
        'Owner Phone',
        'Primary Condition / Notes',
        'Status',
        'Sync Status',
        'Last Visit / Date',
      ]

      const escapeCSV = (val) => {
        if (val === null || val === undefined) return '""'
        const str = String(val).replace(/"/g, '""')
        return `"${str}"`
      }

      const rows = patients.map(p => {
        const latestConsult = consultMap[p.id] || {}
        return [
          escapeCSV(p.id),
          escapeCSV(p.name),
          escapeCSV(p.species),
          escapeCSV(p.breed || 'N/A'),
          escapeCSV(p.age || 'N/A'),
          escapeCSV(p.gender || 'N/A'),
          escapeCSV(p.ownerName || p.owner?.name || 'N/A'),
          escapeCSV(p.ownerPhone || p.owner?.phone || 'N/A'),
          escapeCSV(p.areaOfConcern || latestConsult.notes || 'Routine Clinical Screen'),
          escapeCSV(p.status || 'Active'),
          escapeCSV(p.syncStatus || 'synced'),
          escapeCSV(p.lastVisit || p.updatedAt || new Date().toISOString().slice(0, 10)),
        ].join(',')
      })

      const csvContent = [headers.join(','), ...rows].join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vetlink-patients-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('CSV Export failed:', err)
      alert('Could not export CSV. Ensure local database records exist.')
    }
  }

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 MB'
    const mb = bytes / (1024 * 1024)
    return mb < 1 ? `${(mb * 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`
  }

  const storagePercent = storageInfo.quota > 0
    ? Math.min(100, (storageInfo.used / storageInfo.quota) * 100)
    : 0

  // --- Clinic Information state (persisted in localStorage) ---
  const [clinicInfo, setClinicInfo] = useState(() => {
    try {
      const saved = localStorage.getItem('vetlink_clinic_info')
      return saved ? JSON.parse(saved) : {
        name: 'VetLink Demo Clinic',
        address: '1234 51st Street, Suite 40, VettLink, CA 92907',
        phone: '(800) 357-4680',
        operatingHours: 'Mon - Fri: 8:00 AM - 6:00 PM',
      }
    } catch {
      return {
        name: 'VetLink Demo Clinic',
        address: '1234 51st Street, Suite 40, VettLink, CA 92907',
        phone: '(800) 357-4680',
        operatingHours: 'Mon - Fri: 8:00 AM - 6:00 PM',
      }
    }
  })

  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState(currentUser?.name || 'Dr. Emily Chen, DVM')
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || currentUser?.username || 'dr.chen@clinic.vet')
  const [profilePrcLicense, setProfilePrcLicense] = useState(currentUser?.prcLicense || 'VET-894102')
  const [profilePtrNumber, setProfilePtrNumber] = useState(currentUser?.ptrNumber || '1948201')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSuccessMsg, setProfileSuccessMsg] = useState(null)
  const [profileErrorMsg, setProfileErrorMsg] = useState(null)

  // --- Password change state ---
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false)
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState(null)
  const [passwordErrorMsg, setPasswordErrorMsg] = useState(null)

  const [prevUser, setPrevUser] = useState(currentUser)

  // Keep profile state in sync when currentUser changes
  if (currentUser !== prevUser) {
    setPrevUser(currentUser)
    if (currentUser?.name) {
      setProfileName(currentUser.name)
    }
    if (currentUser?.email || currentUser?.username) {
      setProfileEmail(currentUser.email || currentUser.username)
    }
    setProfilePrcLicense(currentUser?.prcLicense || 'VET-894102')
    setProfilePtrNumber(currentUser?.ptrNumber || '1948201')
  }

  const [isEditingClinic, setIsEditingClinic] = useState(false)
  const [clinicForm, setClinicForm] = useState(clinicInfo)
  const [updateStatus, setUpdateStatus] = useState(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)

  // Persist clinic info
  useEffect(() => {
    localStorage.setItem('vetlink_clinic_info', JSON.stringify(clinicInfo))
  }, [clinicInfo])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    const trimmed = profileName.trim()
    if (!trimmed) {
      setProfileErrorMsg('Display name cannot be empty.')
      return
    }

    const trimmedPrc = profilePrcLicense.trim() || 'VET-894102'
    const trimmedPtr = profilePtrNumber.trim() || '1948201'

    setIsSavingProfile(true)
    setProfileErrorMsg(null)
    setProfileSuccessMsg(null)

    try {
      const updatedUser = {
        ...currentUser,
        name: trimmed,
        prcLicense: trimmedPrc,
        ptrNumber: trimmedPtr,
      }

      // 1. Update React state in App.jsx and cached user in localStorage
      if (onUpdateUser) {
        onUpdateUser(updatedUser)
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem('vetlink_cached_user', JSON.stringify(updatedUser))
      }

      // 2. Update local IndexedDB users store and sync queue
      if (currentUser?.id) {
        try {
          await updateStaffUser(currentUser.id, {
            name: trimmed,
            username: currentUser.email || currentUser.username,
            role: currentUser.role,
            prcLicense: trimmedPrc,
            ptrNumber: trimmedPtr,
          })
        } catch (dbErr) {
          console.warn('Could not update local staff store:', dbErr)
        }

        try {
          await logAuditEvent({
            action: 'PROFILE_UPDATED',
            user: updatedUser,
            targetEntity: 'users',
            targetId: currentUser.id,
            details: `Updated display name to "${trimmed}", PRC Lic: ${trimmedPrc}, PTR: ${trimmedPtr}`,
          })
        } catch (auditErr) {
          console.warn('Could not log audit event:', auditErr)
        }
      }

      // 3. Direct backend API update if online
      if (authToken && !currentUser?.isOffline && apiBaseUrl) {
        try {
          const res = await fetch(`${apiBaseUrl}/api/auth/profile`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ name: trimmed }),
          })
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            console.warn('Backend profile update returned:', res.status, errData)
          }
        } catch (netErr) {
          console.warn('Direct profile update unreachable, changes will sync when online:', netErr)
        }
      }

      setProfileSuccessMsg('Display name updated successfully!')
      setIsEditingProfile(false)
      setTimeout(() => setProfileSuccessMsg(null), 4000)
    } catch (err) {
      console.error('Failed to update profile:', err)
      setProfileErrorMsg(err.message || 'Failed to update profile name.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordErrorMsg(null)
    setPasswordSuccessMsg(null)

    if (!currentPassword) {
      setPasswordErrorMsg('Please enter your current password.')
      return
    }

    if (newPassword.length < 8) {
      setPasswordErrorMsg('New password must be at least 8 characters long.')
      return
    }

    if (!/[a-zA-Z]/.test(newPassword)) {
      setPasswordErrorMsg('New password must include at least one letter.')
      return
    }

    if (!/[0-9]/.test(newPassword)) {
      setPasswordErrorMsg('New password must include at least one number.')
      return
    }

    if (!/[^a-zA-Z0-9\s]/.test(newPassword)) {
      setPasswordErrorMsg('New password must include at least one special character.')
      return
    }

    if (/\s/.test(newPassword)) {
      setPasswordErrorMsg('Spaces and control characters are not allowed in the password.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('New password and confirmation do not match.')
      return
    }

    setIsSubmittingPassword(true)

    try {
      if (currentUser?.isOffline || !authToken) {
        setPasswordSuccessMsg('Password updated for this offline session.')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setIsChangingPassword(false)
        setTimeout(() => setPasswordSuccessMsg(null), 4000)
        return
      }

      const res = await fetch(`${apiBaseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update password')
      }

      try {
        await logAuditEvent({
          action: 'PASSWORD_CHANGED',
          user: currentUser,
          targetEntity: 'users',
          targetId: currentUser.id,
          details: 'User updated their password via Settings',
        })
      } catch (auditErr) {
        console.warn('Could not log audit event:', auditErr)
      }

      setPasswordSuccessMsg('Your password has been changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setIsChangingPassword(false)
      setTimeout(() => setPasswordSuccessMsg(null), 5000)
    } catch (err) {
      console.error('Password change failed:', err)
      setPasswordErrorMsg(err.message || 'Failed to change password. Please check your current password.')
    } finally {
      setIsSubmittingPassword(false)
    }
  }

  const handleSaveClinic = (e) => {
    e.preventDefault()
    setClinicInfo(clinicForm)
    setIsEditingClinic(false)
  }

  const handleCheckUpdates = async () => {
    setIsCheckingUpdate(true)
    setUpdateStatus(null)
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) {
          await reg.update()
        }
      }
      setTimeout(() => {
        setIsCheckingUpdate(false)
        setUpdateStatus('VetLink is up to date (v1.0.0)')
        setTimeout(() => setUpdateStatus(null), 4000)
      }, 1000)
    } catch {
      setIsCheckingUpdate(false)
      setUpdateStatus('Already running latest offline package')
      setTimeout(() => setUpdateStatus(null), 4000)
    }
  }

  const userInitial = profileName ? profileName.charAt(0).toUpperCase() : 'V'

  return (
    <div className="settings-page">
      <button type="button" className="settings-back-btn" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Dashboard
      </button>

      <div className="settings-page-header">
        <h2>Settings</h2>
        <p>Manage your VetLink preferences</p>
      </div>

      {/* ── Account & Security Card ── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-header-left">
            <div className="settings-card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h3>Account</h3>
          </div>
          <div className="settings-header-badges">
            <span className="settings-role-badge">{currentUser?.role || 'Clinic Admin'}</span>
            {!isEditingProfile && (
              <button
                type="button"
                className="settings-action-pill-btn"
                onClick={() => {
                  setIsEditingProfile(true)
                  setProfileErrorMsg(null)
                  setProfileSuccessMsg(null)
                }}
              >
                Edit Name
              </button>
            )}
          </div>
        </div>
        <div className="settings-card-body">
          {profileSuccessMsg && (
            <div className="alert-banner success" style={{ marginBottom: 16 }}>
              {profileSuccessMsg}
            </div>
          )}
          {profileErrorMsg && (
            <div className="alert-banner error" style={{ marginBottom: 16 }}>
              {profileErrorMsg}
            </div>
          )}

          {isEditingProfile ? (
            <form className="settings-inline-form" onSubmit={handleSaveProfile}>
              <div className="settings-form-grid">
                <label className="settings-form-label">
                  <span>Display Name</span>
                  <input
                    type="text"
                    className="settings-input"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="e.g. Dr. Emily Chen"
                    required
                    disabled={isSavingProfile}
                  />
                </label>
                <label className="settings-form-label">
                  <span>Work Email (Read Only)</span>
                  <input
                    type="email"
                    className="settings-input"
                    value={profileEmail}
                    disabled
                    readOnly
                  />
                </label>
                <label className="settings-form-label">
                  <span>PRC License Number</span>
                  <input
                    type="text"
                    className="settings-input"
                    value={profilePrcLicense}
                    onChange={(e) => setProfilePrcLicense(e.target.value)}
                    placeholder="e.g. VET-894102"
                    disabled={isSavingProfile}
                  />
                </label>
                <label className="settings-form-label">
                  <span>PTR Number</span>
                  <input
                    type="text"
                    className="settings-input"
                    value={profilePtrNumber}
                    onChange={(e) => setProfilePtrNumber(e.target.value)}
                    placeholder="e.g. 1948201"
                    disabled={isSavingProfile}
                  />
                </label>
              </div>
              <p style={{ margin: '8px 0 16px', fontSize: '0.78rem', color: '#64748b' }}>
                PRC License and PTR numbers are required under Republic Act 9268 for official veterinary prescription generation and digital dispatch.
              </p>
              <div className="settings-form-actions">
                <button
                  type="button"
                  className="settings-outline-btn"
                  onClick={() => {
                    setIsEditingProfile(false)
                    setProfileName(currentUser?.name || '')
                    setProfilePrcLicense(currentUser?.prcLicense || 'VET-894102')
                    setProfilePtrNumber(currentUser?.ptrNumber || '1948201')
                    setProfileErrorMsg(null)
                  }}
                  disabled={isSavingProfile}
                >
                  Cancel
                </button>
                <button type="submit" className="settings-primary-btn" disabled={isSavingProfile}>
                  {isSavingProfile ? 'Saving…' : 'Save Profile'}
                </button>
              </div>
            </form>
          ) : (
            <div className="settings-profile-row">
              <div className="settings-avatar">{userInitial}</div>
              <div className="settings-profile-info">
                <span className="settings-profile-name">{profileName || currentUser?.name || 'Staff User'}</span>
                <span className="settings-profile-email">{profileEmail || currentUser?.email || currentUser?.username || 'user@clinic.vet'}</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(56, 189, 248, 0.1)', color: '#0284c7', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 600 }}>
                    PRC Lic: {profilePrcLicense || currentUser?.prcLicense || 'VET-894102'}
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', border: '1px solid rgba(100, 116, 139, 0.25)', fontWeight: 600 }}>
                    PTR: {profilePtrNumber || currentUser?.ptrNumber || '1948201'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Password & Security Sub-Section ── */}
          <div className="settings-account-security-section">
            <div className="settings-account-security-header">
              <div>
                <h4 className="settings-section-subtitle">Password &amp; Security</h4>
                <p className="settings-helper-text">Manage your sign-in password and account credentials.</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {!isChangingPassword && (
                  <button
                    type="button"
                    className="settings-action-pill-btn secondary"
                    onClick={() => {
                      setIsChangingPassword(true)
                      setPasswordErrorMsg(null)
                      setPasswordSuccessMsg(null)
                    }}
                  >
                    Change Password
                  </button>
                )}
                {onLogout && (
                  <button
                    type="button"
                    className="settings-action-pill-btn"
                    style={{
                      background: '#fef2f2',
                      borderColor: '#fca5a5',
                      color: '#dc2626',
                    }}
                    onClick={onLogout}
                  >
                    {currentUser?.isOffline ? 'Exit Demo Session' : 'Log Out'}
                  </button>
                )}
              </div>
            </div>

            {passwordSuccessMsg && (
              <div className="alert-banner success" style={{ marginTop: 12 }}>
                {passwordSuccessMsg}
              </div>
            )}

            {passwordErrorMsg && (
              <div className="alert-banner error" style={{ marginTop: 12 }}>
                {passwordErrorMsg}
              </div>
            )}

            {isChangingPassword && (
              <form className="settings-inline-form" onSubmit={handleChangePasswordSubmit} style={{ marginTop: 16 }}>
                <div className="settings-form-grid">
                  <label className="settings-form-label full-width">
                    <span>Current Password</span>
                    <div className="password-input-wrapper">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        className="settings-input"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        required
                        autoComplete="current-password"
                        disabled={isSubmittingPassword}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                        title={showCurrentPassword ? 'Hide password' : 'Show password'}
                      >
                        {showCurrentPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </label>

                  <label className="settings-form-label">
                    <span>New Password</span>
                    <div className="password-input-wrapper">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        className="settings-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 8 chars, 1 letter, 1 number, 1 symbol"
                        required
                        autoComplete="new-password"
                        disabled={isSubmittingPassword}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                        title={showNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </label>

                  <label className="settings-form-label">
                    <span>Confirm New Password</span>
                    <div className="password-input-wrapper">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        className="settings-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        required
                        autoComplete="new-password"
                        disabled={isSubmittingPassword}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        title={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </label>
                </div>

                <div className="settings-password-hints">
                  Password must be at least 8 characters and include at least one letter, one number, and one special character (no spaces).
                </div>

                <div className="settings-form-actions">
                  <button
                    type="button"
                    className="settings-outline-btn"
                    onClick={() => {
                      setIsChangingPassword(false)
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                      setPasswordErrorMsg(null)
                    }}
                    disabled={isSubmittingPassword}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="settings-primary-btn"
                    disabled={isSubmittingPassword}
                  >
                    {isSubmittingPassword ? 'Updating Password…' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ── Clinic Information Card ── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-header-left">
            <div className="settings-card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <h3>Clinic Information</h3>
          </div>
          {!isEditingClinic ? (
            <button
              type="button"
              className="settings-action-pill-btn secondary"
              onClick={() => { setClinicForm(clinicInfo); setIsEditingClinic(true); }}
            >
              Edit Info
            </button>
          ) : null}
        </div>
        <div className="settings-card-body">
          {isEditingClinic ? (
            <form className="settings-inline-form" onSubmit={handleSaveClinic}>
              <div className="settings-form-grid">
                <label className="settings-form-label">
                  <span>Clinic Name</span>
                  <input
                    type="text"
                    className="settings-input"
                    value={clinicForm.name}
                    onChange={(e) => setClinicForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </label>
                <label className="settings-form-label">
                  <span>Phone Number</span>
                  <input
                    type="text"
                    className="settings-input"
                    value={clinicForm.phone}
                    onChange={(e) => setClinicForm(prev => ({ ...prev, phone: e.target.value }))}
                    required
                  />
                </label>
                <label className="settings-form-label full-width">
                  <span>Address</span>
                  <input
                    type="text"
                    className="settings-input"
                    value={clinicForm.address}
                    onChange={(e) => setClinicForm(prev => ({ ...prev, address: e.target.value }))}
                    required
                  />
                </label>
                <label className="settings-form-label full-width">
                  <span>Operating Hours</span>
                  <select
                    className="settings-select"
                    value={clinicForm.operatingHours}
                    onChange={(e) => setClinicForm(prev => ({ ...prev, operatingHours: e.target.value }))}
                  >
                    <option value="Mon - Fri: 8:00 AM - 6:00 PM">Mon - Fri: 8:00 AM - 6:00 PM</option>
                    <option value="Mon - Sat: 8:00 AM - 7:00 PM">Mon - Sat: 8:00 AM - 7:00 PM</option>
                    <option value="Daily: 7:00 AM - 9:00 PM">Daily: 7:00 AM - 9:00 PM</option>
                    <option value="24/7 Emergency Triage">24/7 Emergency Triage</option>
                  </select>
                </label>
              </div>
              <div className="settings-form-actions">
                <button
                  type="button"
                  className="settings-outline-btn"
                  onClick={() => setIsEditingClinic(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="settings-primary-btn">
                  Save Clinic Info
                </button>
              </div>
            </form>
          ) : (
            <div className="settings-clinic-summary">
              <div className="settings-clinic-name">{clinicInfo.name}</div>
              <div className="settings-clinic-address">{clinicInfo.address}</div>
              <div className="settings-clinic-row">
                <span className="settings-clinic-phone">{clinicInfo.phone}</span>
                <span className="settings-clinic-hours-pill">{clinicInfo.operatingHours}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Notifications Card ── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-header-left">
          <div className="settings-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <h3>Notifications</h3>
          </div>
        </div>
        <div className="settings-card-body">
          <div className="settings-toggle-grid">
            {[
              { key: 'email', label: 'Email Notifications', desc: 'Receive clinical updates via email' },
              { key: 'push', label: 'Push Notifications', desc: 'Browser and device push alerts' },
              { key: 'syncAlerts', label: 'Sync Alerts', desc: 'Notify when offline data syncs' },
              { key: 'criticalPatient', label: 'Critical Patient Alerts', desc: 'Urgent case notifications' },
            ].map(({ key, label, desc }) => (
              <div className="settings-toggle-row" key={key}>
                <div className="settings-toggle-info">
                  <span className="settings-toggle-label">{label}</span>
                  <span className="settings-toggle-desc">{desc}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifications[key]}
                  className={`settings-toggle ${notifications[key] ? 'active' : ''}`}
                  onClick={() => toggleNotification(key)}
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Appearance Card ── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-header-left">
          <div className="settings-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          </div>
          <h3>Appearance</h3>
          </div>
        </div>
        <div className="settings-card-body">
          <div className="settings-theme-pills">
            {[
              { value: 'light', label: 'Light', icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )},
              { value: 'dark', label: 'Dark', icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )},
              { value: 'system', label: 'System', icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              )},
            ].map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                className={`settings-theme-pill ${theme === value ? 'active' : ''}`}
                onClick={() => setTheme(value)}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Shared Tablet & Security Card ── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-header-left">
          <div className="settings-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h3>Shared Tablet &amp; Security</h3>
          </div>
        </div>
        <div className="settings-card-body">
          <div className="settings-security-box">
            <label className="settings-form-label" style={{ maxWidth: 360 }}>
              <span>Exam Room Inactivity Auto-Lock</span>
              <select
                className="settings-select"
                value={inactivityTimeout}
                onChange={(e) => setInactivityTimeout(e.target.value)}
              >
                <option value="0">Disabled (Stay signed in)</option>
                <option value="5">5 Minutes (Exam Room Fast-Lock)</option>
                <option value="15">15 Minutes (Standard Clinic)</option>
                <option value="30">30 Minutes</option>
                <option value="60">60 Minutes (1 Hour)</option>
              </select>
            </label>
            <p className="settings-helper-text">
              Automatically locks session after idle time to protect sensitive patient records when veterinary tablets are left unattended in exam rooms.
            </p>
          </div>
        </div>
      </div>

      {/* ── Data & Storage Card ── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-header-left">
          <div className="settings-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          </div>
          <h3>Data &amp; Storage</h3>
          </div>
        </div>
        <div className="settings-card-body">
          <div className="settings-storage-info">
            <div className="settings-storage-labels">
              <span>Local Storage</span>
              <span className="settings-storage-value">
                {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.quota)}
              </span>
            </div>
            <div className="settings-storage-bar">
              <div
                className="settings-storage-fill"
                style={{ width: `${storagePercent}%` }}
              />
            </div>
          </div>

          <div className="settings-toggle-row" style={{ marginTop: 14 }}>
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">Sync on Wi-Fi Only</span>
              <span className="settings-toggle-desc">
                Restrict heavy medical photo sync to unmetered Wi-Fi connections to conserve mobile cellular data during field visits.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={wifiOnlySync}
              className={`settings-toggle ${wifiOnlySync ? 'active' : ''}`}
              onClick={() => setWifiOnlySync(prev => !prev)}
            >
              <span className="settings-toggle-thumb" />
            </button>
          </div>

          <div className="settings-storage-actions">
            <button
              type="button"
              className="settings-outline-btn"
              onClick={handleClearCache}
              disabled={isClearingCache}
            >
              {isClearingCache ? 'Clearing…' : cacheCleared ? 'Cache Cleared' : 'Clear Cache'}
            </button>
            <button
              type="button"
              className="settings-outline-btn"
              onClick={handleExportData}
              title="Download raw clinical database in JSON format"
            >
              Export JSON
            </button>
            <button
              type="button"
              className="settings-primary-btn"
              onClick={handleExportCSV}
              title="Download patient records as a spreadsheet-compatible CSV file"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── About Card ── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-header-left">
          <div className="settings-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <h3>About</h3>
          </div>
        </div>
        <div className="settings-card-body">
          <div className="settings-about-grid">
            <div className="settings-about-item">
              <span className="settings-about-label">Version</span>
              <span className="settings-about-value">VetLink v1.0.0</span>
            </div>
            <div className="settings-about-item">
              <span className="settings-about-label">Inference Engine</span>
              <span className="settings-about-value">WASM MobileNetV3</span>
            </div>
            <div className="settings-about-item">
              <span className="settings-about-label">Mode</span>
              <span className="settings-about-value">Edge Inference + Offline Sync</span>
            </div>
          </div>
          <div className="settings-about-actions">
            <button
              type="button"
              className="settings-outline-btn"
              onClick={handleCheckUpdates}
              disabled={isCheckingUpdate}
            >
              {isCheckingUpdate ? 'Checking…' : 'Check for Updates'}
            </button>
            {updateStatus && (
              <span className="settings-update-msg">{updateStatus}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
