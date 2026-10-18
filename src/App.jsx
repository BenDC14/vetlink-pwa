import { useState } from 'react'
import heroImg from './assets/hero.png'
import './App.css'
import Login from './pages/Login'
import ClinicalAnalysis from './pages/ClinicalAnalysis'
import Patients from './pages/Patients'
import Staff from './pages/Staff'
import Sync from './pages/Sync'
import PendingApprovals from './pages/PendingApprovals'
import NewPatient from './pages/NewPatient'
import AdminApproval from './pages/AdminApproval'
import Treatment from './pages/Treatment'

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
  const [showAdminApproval, setShowAdminApproval] = useState(false)
  const [showTreatment, setShowTreatment] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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

  const handleLogin = (event) => {
    event.preventDefault()
    if (email && password) {
      setLoggedIn(true)
    }
  }

  return (
    <main className={`app-shell ${!loggedIn ? 'auth-shell' : ''}`}>
      {!loggedIn ? (
        <Login email={email} password={password} setEmail={setEmail} setPassword={setPassword} onLogin={handleLogin} />
      ) : (
        <div className="dashboard-shell">
          <aside className="dashboard-sidebar">
            <div className="sidebar-brand">
              <div className="brand-badge">ADMIN</div>
              <p className="sidebar-subtitle">Veterinarian</p>
            </div>
            <nav className="sidebar-nav">
              <button className={"nav-item " + (activeView === 'clinic' ? 'active' : '')} onClick={() => { setActiveView('clinic'); setShowNewPatient(false); }}>
                <span>Clinic Analysis</span>
              </button>
              <button className={"nav-item " + (activeView === 'patients' ? 'active' : '')} onClick={() => { setActiveView('patients'); setShowNewPatient(false); }}>
                <span>Patient Records</span>
              </button>
              <button className={"nav-item " + (activeView === 'staff' ? 'active' : '')} onClick={() => { setActiveView('staff'); setShowNewPatient(false); }}>
                <span>Manage Staff</span>
              </button>
              <button className={"nav-item " + (activeView === 'sync' ? 'active' : '')} onClick={() => { setActiveView('sync'); setShowNewPatient(false); }}>
                <span>Sync</span>
              </button>
              <button className={"nav-item nav-warning " + (activeView === 'pending' ? 'active' : '')} onClick={() => { setActiveView('pending'); setShowNewPatient(false); }}>
                <span>Pending Approval</span>
                <span className="nav-badge">3</span>
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
                <h2>{showTreatment ? 'Treatment' : showAdminApproval ? 'Admin Approval' : showNewPatient ? 'New Patient' : {
                  clinic: 'Clinic Analysis',
                  patients: 'Patient Records',
                  staff: 'Manage Staff',
                  sync: 'Sync',
                  pending: 'Pending Approval',
                }[activeView]}</h2>
              </div>
              <button className="secondary-btn" onClick={() => {
                setLoggedIn(false)
                setActiveView('clinic')
                setShowNewPatient(false)
                setShowAdminApproval(false)
                setShowTreatment(false)
              }}>Log out</button>
            </header>

            {showTreatment ? (
              <Treatment onBack={() => { setShowTreatment(false); setShowAdminApproval(false); setShowNewPatient(false); }} />
            ) : showAdminApproval ? (
              <AdminApproval
                onBack={() => { setShowAdminApproval(false); setShowNewPatient(false); }}
                onApprove={() => { setShowTreatment(true); setShowAdminApproval(false); }}
              />
            ) : showNewPatient ? (
              <NewPatient
                onBack={() => setShowNewPatient(false)}
                onViewPending={() => { setShowNewPatient(false); setActiveView('pending'); }}
                onCapture={() => { setShowAdminApproval(true); setShowNewPatient(false); }}
              />
            ) : (
              <>
                {activeView === 'clinic' && <ClinicalAnalysis />}
                {activeView === 'patients' && <Patients />}
                {activeView === 'staff' && <Staff />}
                {activeView === 'sync' && <Sync />}
                {activeView === 'pending' && <PendingApprovals />}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

export default App