import { useState, useRef, useEffect } from 'react'
import { addPatient, addConsultation, addScreeningResult } from '../db/database'
import { loadVetLinkModel, predict, loadImageFromFile } from '../vetlink-ai'

export default function NewPatient({ onBack, onViewPending, onCapture }) {
  const [name, setName]                 = useState('')
  const [species, setSpecies]           = useState('Canine')
  const [areaOfConcern, setAreaOfConcern] = useState('')
  const [isSaving, setIsSaving]         = useState(false)
  const [error, setError]               = useState('')

  // Image & AI state
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl]     = useState(null)
  const [isAnalyzing, setIsAnalyzing]   = useState(false)
  const [aiResult, setAiResult]         = useState(null)
  const [modelReady, setModelReady]     = useState(false)
  const [modelError, setModelError]     = useState(null)

  const fileInputRef = useRef(null)

  // Pre-load the model in the background as soon as the page mounts
  useEffect(() => {
    let cancelled = false
    loadVetLinkModel()
      .then(() => { if (!cancelled) setModelReady(true) })
      .catch((err) => { if (!cancelled) setModelError(err.message) })
    return () => { cancelled = true }
  }, [])

  // When user picks a file, show preview and immediately run AI
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Revoke previous preview URL to avoid memory leaks
    if (previewUrl) URL.revokeObjectURL(previewUrl)

    const url = URL.createObjectURL(file)
    setSelectedFile(file)
    setPreviewUrl(url)
    setAiResult(null)
    setError('')

    // Run AI automatically after image is selected
    setIsAnalyzing(true)
    try {
      const imgElement = await loadImageFromFile(file)
      const result     = await predict(imgElement)
      setAiResult(result)
    } catch (err) {
      console.error('AI inference failed:', err)
      setError('AI could not analyze this image. Please try another photo.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Called when "CAPTURE & RUN AI" button is clicked — opens camera/file picker
  const handleOpenCamera = () => {
    if (!name.trim()) {
      setError('Please enter a patient name first.')
      return
    }
    setError('')
    fileInputRef.current?.click()
  }

  // Called when "SAVE & SEND FOR REVIEW" is clicked after AI runs
  const handleSave = async () => {
    if (!name.trim()) { setError('Patient name is required.'); return }
    if (!selectedFile) { setError('Please capture or upload a photo first.'); return }
    if (!aiResult)    { setError('Waiting for AI analysis to complete.'); return }

    setIsSaving(true)
    setError('')

    try {
      // 1. Save patient
      const patient = await addPatient({
        name:          name.trim(),
        species,
        areaOfConcern: areaOfConcern.trim(),
        lastVisit:     new Date().toISOString().slice(0, 10),
        status:        'Active',
      })

      // 2. Save consultation linked to the patient
      const consultation = await addConsultation({
        patientId:       patient.id,
        clinicalNotes:   areaOfConcern.trim(),
        diagnosis:       aiResult.label,
        treatmentPlan:   '',
      })

      // 3. Convert image to base64 for local storage
      const base64Image = await fileToBase64(selectedFile)

      // 4. Save screening result linked to the consultation
      await addScreeningResult({
        consultationId:  consultation.id,
        imageId:         null,
        imageData:       base64Image,
        aiLabel:         aiResult.label,
        aiDisplayLabel:  aiResult.displayLabel,
        aiConfidence:    aiResult.confidence,
        aiPercent:       aiResult.percent,
        aiDescription:   aiResult.description,
        aiTop3:          JSON.stringify(aiResult.top3),
        species,
        reviewStatus:    'pending',
      })

      // 5. Navigate to AdminApproval with the full result
      onCapture({
        patient,
        consultation,
        aiResult,
        previewUrl,
      })

    } catch (saveError) {
      console.error('Failed to save patient:', saveError)
      setError('Unable to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Confidence color: green ≥ 80%, yellow ≥ 50%, red < 50%
  const confidenceColor = aiResult
    ? aiResult.confidence >= 0.8 ? '#22c55e'
    : aiResult.confidence >= 0.5 ? '#f59e0b'
    : '#ef4444'
    : '#888'

  return (
    <section className="new-patient-card">
      {/* Hidden file input — opens camera on mobile, file picker on desktop */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-label="Capture or upload a pet photo"
      />

      <div className="new-patient-header">
        <button className="secondary-btn small-back" type="button" onClick={onBack}>← DASHBOARD</button>
        <span className={`status-chip ${modelReady ? 'green' : modelError ? 'red' : 'gray'}`}>
          {modelReady ? 'AI READY' : modelError ? 'AI ERROR' : 'LOADING AI...'}
        </span>
      </div>

      <div className="new-patient-topbar">
        <div>
          <div className="brand-badge">NEW CASE</div>
          <p>Fill in details then capture a photo</p>
        </div>
      </div>

      <div className="new-patient-main">

        {/* ── Left: Image Preview ─────────────────────────────── */}
        <div className="new-patient-preview">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Pet photo preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
            />
          ) : (
            <div
              className="image-placeholder"
              style={{ cursor: 'pointer' }}
              onClick={handleOpenCamera}
              role="button"
              aria-label="Click to capture or upload a photo"
            >
              📷 Click to capture photo
            </div>
          )}

          {/* Retake button */}
          {previewUrl && (
            <button
              type="button"
              className="secondary-btn"
              style={{ marginTop: 8, width: '100%' }}
              onClick={handleOpenCamera}
              disabled={isAnalyzing || isSaving}
            >
              🔄 RETAKE PHOTO
            </button>
          )}
        </div>

        {/* ── Right: Form + AI Result ─────────────────────────── */}
        <div className="new-patient-form-card">
          <div className="form-card-heading">Patient Details</div>
          <div className="new-patient-form">
            <p className="id-auto-note">Patient ID will be assigned automatically.</p>

            <label>
              <span>PATIENT NAME</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Buddy"
                disabled={isSaving}
              />
            </label>

            <label>
              <span>SPECIES</span>
              <select
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                disabled={isSaving}
              >
                <option>Canine</option>
                <option>Feline</option>
                <option>Avian</option>
                <option>Rabbit</option>
              </select>
            </label>

            <label>
              <span>AREA OF CONCERN</span>
              <input
                value={areaOfConcern}
                onChange={(e) => setAreaOfConcern(e.target.value)}
                placeholder="Back leg rash"
                disabled={isSaving}
              />
            </label>

            {error && <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '4px 0' }}>{error}</p>}

            {/* AI Analysis Result */}
            {isAnalyzing && (
              <div className="ai-result-box analyzing">
                <span className="ai-spinner">⏳</span> Analyzing image with AI...
              </div>
            )}

            {aiResult && !isAnalyzing && (
              <div className="ai-result-box">
                <div className="ai-result-label">
                  🤖 AI Result: <strong>{aiResult.displayLabel}</strong>
                </div>
                <div className="ai-result-confidence" style={{ color: confidenceColor }}>
                  Confidence: <strong>{aiResult.percent}</strong>
                </div>
                <div className="ai-result-description" style={{ fontSize: '0.82rem', color: '#555', marginTop: 4 }}>
                  {aiResult.description}
                </div>
                <div className="ai-top3" style={{ marginTop: 8, fontSize: '0.8rem', color: '#777' }}>
                  <strong>Top 3:</strong>
                  {aiResult.top3.map((item, i) => (
                    <span key={i} style={{ marginLeft: 6 }}>
                      {i + 1}. {item.display} ({(item.confidence * 100).toFixed(0)}%)
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="form-actions-row" style={{ flexDirection: 'column', gap: 8 }}>
              {/* Step 1: Capture photo */}
              {!previewUrl && (
                <button
                  className="capture-btn"
                  type="button"
                  onClick={handleOpenCamera}
                  disabled={isSaving || isAnalyzing}
                >
                  <span>📷</span>
                  CAPTURE & RUN AI
                </button>
              )}

              {/* Step 2: Save after AI result is ready */}
              {aiResult && !isAnalyzing && (
                <button
                  className="capture-btn"
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
                >
                  {isSaving ? '⏳ SAVING...' : '✓ SAVE & SEND FOR REVIEW'}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      <div className="admin-access-card">
        <p className="eyebrow">Admin approval access</p>
        <p>After saving, a vet must approve the AI result before treatment is generated.</p>
        <button className="view-pending-btn" type="button" onClick={onViewPending}>
          VIEW PENDING APPROVALS
        </button>
      </div>
    </section>
  )
}

// Helper: convert File to base64 string for local storage
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
