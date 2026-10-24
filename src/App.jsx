import { useEffect, useState } from 'react'
import heroImg from './assets/hero.png'
import './App.css'
import Login from './pages/Login'
import ClinicalAnalysis from './pages/ClinicalAnalysis'
import Patients from './pages/Patients'
import Staff from './pages/Staff'
import Sync from './pages/Sync'
import NewPatient from './pages/NewPatient'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const steps = [
  'Log in securely to access your workspace',
  'Capture a clear image of the affected area',
  'Upload it from your camera or gallery',
  'Review the support summary and next steps',
]

function App() {
  const [image, setImage] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [activeView, setActiveView] = useState('clinic')
  const [showNewPatient, setShowNewPatient] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authToken, setAuthToken] = useState(() => sessionStorage.getItem('vetlink_auth_token') || '')
  const [currentUser, setCurrentUser] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(Boolean(sessionStorage.getItem('vetlink_auth_token')))

  useEffect(() => {
    if (!authToken) return

    fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session expired')
        return response.json()
      })
      .then((user) => {
        setCurrentUser(user)
        if (!user.must_change_password) setLoggedIn(true)
      })
      .catch(() => {
        sessionStorage.removeItem('vetlink_auth_token')
        setAuthToken('')
        setCurrentUser(null)
      })
      .finally(() => setIsCheckingSession(false))
  }, [authToken])

  const handleImageChange = (event) => {
    const selectedImage = event.target.files?.[0]

    if (!selectedImage) {
      return
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    const nextPreviewUrl = URL.createObjectURL(selectedImage)
    setImage(selectedImage)
    setPreviewUrl(nextPreviewUrl)
    setResult(null)
  }

  const handleAnalyze = () => {
    if (!image) {
      return
    }

    setIsAnalyzing(true)
    setResult(null)

    window.setTimeout(() => {
      setResult({
        title: 'Possible irritant contact dermatitis',
        confidence: 'High confidence',
        summary:
          'The lesion pattern suggests a non-infectious skin irritation. Keep the area clean and monitor for improvement over 48 hours.',
        nextSteps: ['Avoid further irritation', 'Use gentle cleansing', 'Contact a veterinarian if it spreads'],
      })
      setIsAnalyzing(false)
    }, 1200)
  }

  const handleOfflineLogin = (role = 'Clinic Admin') => {
    const offlineUser = {
      id: 'ST-001',
      name: 'Dr. Sarah Lin (Offline Demo)',
      role: role,
      email: email || 'dr.sarah.lin@clinic.vet',
      isOffline: true,
    }
    setCurrentUser(offlineUser)
    setLoggedIn(true)
  }

  const handleLogin = async ({ email: loginEmail, password: loginPassword }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || 'Unable to sign in')

      sessionStorage.setItem('vetlink_auth_token', result.access_token)
      setAuthToken(result.access_token)
      setCurrentUser({ ...result.user, must_change_password: result.must_change_password })
      if (!result.must_change_password) setLoggedIn(true)
      return result
    } catch (err) {
      // If backend server is unreachable (Failed to fetch), allow seamless offline demo login!
      if (err.name === 'TypeError' || err.message?.includes('fetch') || err.message?.includes('NetworkError') || err.message?.includes('Failed to fetch')) {
        console.warn('Backend server unreachable. Logging in with local offline session.')
        handleOfflineLogin('Clinic Admin')
        return { offline: true }
      }
      throw err
    }
  }

  const handleChangePassword = async ({ currentPassword, newPassword }) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.detail || 'Unable to change password')
    setCurrentUser((user) => ({ ...user, must_change_password: false }))
    setLoggedIn(true)
  }

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      })
    } catch {
      // Clear the local session even when the server cannot be reached.
    } finally {
      sessionStorage.removeItem('vetlink_auth_token')
      setAuthToken('')
      setCurrentUser(null)
      setLoggedIn(false)
      setActiveView('clinic')
      setShowNewPatient(false)
    }
  }

  return (
    <main className={`app-shell ${!loggedIn ? 'auth-shell' : ''}`}>
      {isCheckingSession ? (
        <div className="auth-loading" role="status">Checking your session...</div>
      ) : !loggedIn ? (
        <Login
          email={email}
          password={password}
          setEmail={setEmail}
          setPassword={setPassword}
          onLogin={handleLogin}
          onChangePassword={handleChangePassword}
        />
      ) : (
        <div className="dashboard-shell">
          <aside className="dashboard-sidebar">
            <div className="sidebar-brand">
              <p className="brand-badge">{currentUser?.role === 'Clinic Admin' ? 'Clinic Admin' : 'Clinic Staff'}</p>
            </div>
            <nav className="sidebar-nav">
              <button className={"nav-item " + (activeView === 'clinic' ? 'active' : '')} onClick={() => { setActiveView('clinic'); setShowNewPatient(false); }}>
                <span>Clinic Analysis</span>
              </button>
              <button className={"nav-item " + (activeView === 'patients' ? 'active' : '')} onClick={() => { setActiveView('patients'); setShowNewPatient(false); }}>
                <span>Patient Records</span>
              </button>
              {currentUser?.role === 'Clinic Admin' && (
                <button className={"nav-item " + (activeView === 'staff' ? 'active' : '')} onClick={() => { setActiveView('staff'); setShowNewPatient(false); }}>
                  <span>Manage Staff</span>
                </button>
              )}
              <button className={"nav-item " + (activeView === 'sync' ? 'active' : '')} onClick={() => { setActiveView('sync'); setShowNewPatient(false); }}>
                <span>Sync</span>
              </button>
            </nav>
            <div className="sidebar-actions">
              <button className="action-btn blue" onClick={() => setShowNewPatient(true)}>New Patient</button>
              <button className="action-btn secondary">Install PWA</button>
            </div>
          </aside>

          <section className="dashboard-panel">
            <header className="dashboard-header">
              <div>
                <h2>{showNewPatient ? 'New Patient' : {
                  clinic: 'Clinic Analysis',
                  patients: 'Patient Records',
                  staff: 'Manage Staff',
                  sync: 'Sync',
                }[activeView]}</h2>
              </div>
              <button className="secondary-btn" onClick={handleLogout}>Log out</button>
            </header>

            {showNewPatient ? (
              <NewPatient
                onBack={() => setShowNewPatient(false)}
                authToken={authToken}
                apiBaseUrl={API_BASE_URL}
                isOffline={currentUser?.isOffline}
                onCapture={() => { setShowNewPatient(false); setActiveView('patients'); }}
              />
            ) : (
              <>
                {activeView === 'clinic' && <ClinicalAnalysis />}
                {activeView === 'patients' && <Patients authToken={authToken} apiBaseUrl={API_BASE_URL} isOffline={currentUser?.isOffline} />}
                {activeView === 'staff' && currentUser?.role === 'Clinic Admin' && <Staff authToken={authToken} apiBaseUrl={API_BASE_URL} />}
                {activeView === 'sync' && <Sync authToken={authToken} apiBaseUrl={API_BASE_URL} />}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

export default App