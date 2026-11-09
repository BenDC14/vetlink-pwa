import { useState, useEffect } from 'react'
import { updatePatient, logAuditEvent } from '../db/database'

export default function EmailPrescriptionModal({
  isOpen,
  onClose,
  patient,
  consultation,
  prescription = '',
  clinicalNotes = '',
  diagnosis = '',
  doctorName = 'Dr. Sarah Lin, DVM',
  currentUser,
  authToken,
  apiBaseUrl = 'http://localhost:8000',
  onPrescriptionSent,
}) {
  const initialEmail = patient?.ownerEmail || ''
  const [recipientEmail, setRecipientEmail] = useState(initialEmail)
  const [emailSubject, setEmailSubject] = useState('')
  const [personalNote, setPersonalNote] = useState('')
  const [saveToPatient, setSaveToPatient] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [showFullDoc, setShowFullDoc] = useState(false)

  const patientName = patient?.name || 'Buddy'
  const patientSpecies = patient?.species || 'Canine'
  const patientBreed = patient?.breed || 'Aspin'
  const patientWeight = patient?.weight ? `${patient.weight} kg` : 'N/A'
  const ownerName = patient?.ownerName || 'Pet Owner'
  const ownerPhone = patient?.ownerPhone || 'N/A'
  const todayStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const cleanRxId = consultation?.id || (patient?.id ? `RX-${patient.id.replace('PAT-', '')}` : `RX-${Date.now().toString().slice(-6)}`)
  const cleanDiagnosis = diagnosis || consultation?.diagnosis || patient?.areaOfConcern || 'Cutaneous Dermatological Condition'
  const cleanDoctor = doctorName || (currentUser?.name ? `Dr. ${currentUser.name}` : 'Dr. Sarah Lin, DVM')

  // Keep state synchronized when modal opens or patient changes
  useEffect(() => {
    if (isOpen) {
      const email = patient?.ownerEmail || ''
      setRecipientEmail(email)
      setEmailSubject(`Official Veterinary Prescription - ${patientName} (${cleanDiagnosis})`)
      setPersonalNote('')
      setStatusMessage('')
      setErrorMessage('')
      setCopied(false)
    }
  }, [isOpen, patient, patientName, cleanDiagnosis])

  if (!isOpen) return null

  // Compose Full Prescription Document Plain Text
  const generatePrescriptionText = () => {
    return [
      '==================================================',
      'VETLINK ANIMAL CARE CLINIC & HOSPITAL',
      'Veterinary Medical Center • Department of Clinical Dermatology',
      '102 Rizal Avenue, Brgy. San Antonio • Tel: (02) 8876-5432',
      'Mobile: 0917-123-4567 • Email: clinic@vetlink.ph',
      '==================================================',
      '',
      'OFFICIAL VETERINARY PRESCRIPTION (℞)',
      '',
      `PATIENT:         ${patientName}`,
      `SPECIES / BREED: ${patientSpecies} • ${patientBreed}`,
      `WEIGHT:          ${patientWeight}`,
      `OWNER:           ${ownerName}`,
      `CONTACT:         ${ownerPhone}`,
      `DATE:            ${todayStr}`,
      `CASE / RX ID:    ${cleanRxId}`,
      '',
      'CLINICAL DIAGNOSIS:',
      cleanDiagnosis,
      '',
      '℞ MEDICATION & DOSAGE DISPENSING ORDER:',
      '--------------------------------------------------',
      prescription || 'No oral or topical medication prescribed.',
      '--------------------------------------------------',
      '',
      'CLINICAL CARE, HOME ADMINISTRATION & RECHECK INSTRUCTIONS:',
      clinicalNotes || 'Follow standard home hygiene and monitoring.',
      '',
      personalNote ? `CLINIC STAFF INSTRUCTIONS TO OWNER:\n"${personalNote}"\n` : '',
      'ATTENDING VETERINARIAN:',
      cleanDoctor,
      'PRC License No.: VET-894102',
      'PTR No.: 1948201',
      '',
      '--------------------------------------------------',
      'Notice: Official prescription issued under Republic Act 9268.',
      'Valid for 30 days from date of examination.',
      'Substitution requires attending veterinarian authorization.',
      '==================================================',
    ].filter(Boolean).join('\n')
  }

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  }

  // Persist updated email to patient store if changed
  const syncEmailToPatientRecord = async (targetEmail) => {
    if (saveToPatient && patient?.id && targetEmail && targetEmail !== patient.ownerEmail) {
      try {
        await updatePatient(patient.id, { ownerEmail: targetEmail })
      } catch (err) {
        console.warn('Failed to update owner email in local patient record:', err)
      }
    }
  }

  // Option 1: Send via Clinic Cloud Email Endpoint
  const handleSendCloudEmail = async (e) => {
    if (e) e.preventDefault()
    setErrorMessage('')
    setStatusMessage('')

    const trimmedEmail = recipientEmail.trim()
    if (!trimmedEmail) {
      setErrorMessage('Please enter an owner email address.')
      return
    }
    if (!validateEmail(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. owner@example.com).')
      return
    }

    setIsSending(true)
    try {
      await syncEmailToPatientRecord(trimmedEmail)

      const payload = {
        recipient_email: trimmedEmail,
        patient_id: patient?.id || null,
        patient_name: patientName,
        owner_name: ownerName,
        species: patientSpecies,
        breed: patientBreed,
        weight: patient?.weight ? String(patient.weight) : null,
        diagnosis: cleanDiagnosis,
        prescription_text: prescription,
        clinical_notes: personalNote
          ? `${clinicalNotes}\n\nClinic Staff Note: ${personalNote}`
          : clinicalNotes,
        doctor_name: cleanDoctor,
        rx_id: cleanRxId,
      }

      const headers = { 'Content-Type': 'application/json' }
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      const res = await fetch(`${apiBaseUrl}/api/prescriptions/email`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || `Server responded with status ${res.status}`)
      }

      const data = await res.json()
      setStatusMessage(data.message || `Official prescription successfully emailed to ${trimmedEmail}!`)

      // Record Audit Event
      await logAuditEvent({
        action: 'PRESCRIPTION_EMAILED',
        user: currentUser || { name: 'Clinic Staff', role: 'Staff' },
        targetEntity: 'patients',
        targetId: patient?.id || '',
        details: `Dispatched prescription for ${patientName} to ${trimmedEmail} via Cloud Email.`,
      })

      if (onPrescriptionSent) {
        onPrescriptionSent(trimmedEmail)
      }
    } catch (err) {
      console.warn('Cloud email dispatch failed:', err)
      setErrorMessage(
        `Cloud email could not be delivered (${err.message || 'Network unavailable'}). You can immediately open and send via your device's email app using the button below.`
      )
    } finally {
      setIsSending(false)
    }
  }

  // Option 2: Send via Native Email Client (mailto:), 100% Offline Compatible
  const handleSendMailto = async () => {
    setErrorMessage('')
    setStatusMessage('')

    const trimmedEmail = recipientEmail.trim()
    if (!trimmedEmail) {
      setErrorMessage('Please enter an owner email address.')
      return
    }
    if (!validateEmail(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. owner@example.com).')
      return
    }

    try {
      await syncEmailToPatientRecord(trimmedEmail)

      const bodyText = generatePrescriptionText()
      const subjectText = emailSubject.trim() || `Official Prescription - ${patientName}`
      const mailtoUrl = `mailto:${encodeURIComponent(trimmedEmail)}?subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(bodyText)}`

      // Open mail client
      window.location.href = mailtoUrl

      setStatusMessage(`Launched email client with pre-filled prescription for ${trimmedEmail}.`)

      // Record Audit Event
      await logAuditEvent({
        action: 'PRESCRIPTION_EMAILED',
        user: currentUser || { name: 'Clinic Staff', role: 'Staff' },
        targetEntity: 'patients',
        targetId: patient?.id || '',
        details: `Opened prescription in email client for ${patientName} to ${trimmedEmail}.`,
      })

      if (onPrescriptionSent) {
        onPrescriptionSent(trimmedEmail)
      }
    } catch (err) {
      setErrorMessage(`Failed to open email client: ${err.message}`)
    }
  }

  // Option 3: Copy full prescription text
  const handleCopyText = async () => {
    try {
      const text = generatePrescriptionText()
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setStatusMessage('Full prescription copied to clipboard (ready to paste into SMS or messaging app).')
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      setErrorMessage('Unable to copy to clipboard.')
    }
  }

  return (
    <div className="modal-overlay no-print" role="dialog" aria-modal="true" style={{ zIndex: 1200 }}>
      <div
        className="modal-dialog"
        style={{
          maxWidth: 680,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <header className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.4rem' }}>✉️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800, color: 'var(--text-h)' }}>
                Email Prescription to Owner
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
                Send official digital prescription (℞) directly to pet owner
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ✕
          </button>
        </header>

        {/* Scrollable Form Body */}
        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Status Alerts */}
          {statusMessage && (
            <div
              className="alert-banner success"
              style={{
                background: '#dcfce7',
                color: '#166534',
                border: '1px solid #86efac',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: '0.86rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>✅</span>
              <span style={{ flex: 1 }}>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div
              className="alert-banner error"
              style={{
                background: '#fee2e2',
                color: '#991b1b',
                border: '1px solid #fca5a5',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <span>⚠️</span>
              <span style={{ flex: 1 }}>{errorMessage}</span>
            </div>
          )}

          {/* Patient Quick Summary Box */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
              padding: '12px 14px',
              background: 'var(--surface-2, #f8fafc)',
              borderRadius: 8,
              border: '1px solid var(--border, #cbd5e1)',
              fontSize: '0.82rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>
                Patient
              </span>
              <strong style={{ fontSize: '0.94rem', color: 'var(--text-h)' }}>{patientName}</strong>
              <div style={{ color: 'var(--text)', fontSize: '0.78rem' }}>
                {patientSpecies} • {patientBreed} {patient?.weight ? `(${patient.weight} kg)` : ''}
              </div>
            </div>

            <div>
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>
                Owner & Contact
              </span>
              <strong style={{ fontSize: '0.92rem', color: 'var(--text-h)' }}>{ownerName}</strong>
              <div style={{ color: 'var(--text)', fontSize: '0.78rem' }}>{ownerPhone}</div>
            </div>

            <div style={{ gridColumn: 'span 1' }}>
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>
                Diagnosis
              </span>
              <strong style={{ color: '#0284c7', fontSize: '0.88rem' }}>{cleanDiagnosis}</strong>
              <div style={{ color: 'var(--muted)', fontSize: '0.74rem' }}>{todayStr}</div>
            </div>
          </div>

          {/* Email Recipient Input */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-h)' }}>
              Pet Owner's Email Address <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="e.g. petowner@gmail.com"
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1.5px solid var(--border, #cbd5e1)',
                background: 'var(--surface, #ffffff)',
                color: 'var(--text, #0f172a)',
                fontSize: '0.92rem',
                minHeight: 44,
                boxSizing: 'border-box',
              }}
            />
            {patient?.id && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 6,
                  fontSize: '0.78rem',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={saveToPatient}
                  onChange={(e) => setSaveToPatient(e.target.checked)}
                />
                <span>Save this email to patient's clinical file for future visits</span>
              </label>
            )}
          </div>

          {/* Email Subject Input */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-h)' }}>
              Subject Line
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Prescription Subject"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border, #cbd5e1)',
                background: 'var(--surface, #ffffff)',
                color: 'var(--text, #0f172a)',
                fontSize: '0.86rem',
                minHeight: 40,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Optional Staff Personal Note to Owner */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-h)' }}>
              Optional Note from Clinic Staff (Appended to Email)
            </label>
            <textarea
              value={personalNote}
              onChange={(e) => setPersonalNote(e.target.value)}
              rows={2}
              placeholder="e.g. Please pick up the medicated shampoo at the front desk before 5:00 PM. Call us immediately if any vomiting occurs."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border, #cbd5e1)',
                background: 'var(--surface, #ffffff)',
                color: 'var(--text, #0f172a)',
                fontSize: '0.84rem',
                lineHeight: 1.45,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Collapsible Document Preview */}
          <div style={{ border: '1px solid var(--border, #cbd5e1)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setShowFullDoc((prev) => !prev)}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--surface-2, #f1f5f9)',
                border: 'none',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.82rem',
                color: 'var(--text-h)',
              }}
            >
              <span>📄 Document Content Preview ({prescription ? 'Prescription & Notes' : 'Empty Rx'})</span>
              <span>{showFullDoc ? '▲ Collapse' : '▼ View Preview'}</span>
            </button>

            {showFullDoc && (
              <div
                style={{
                  padding: 14,
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                  maxHeight: 220,
                  overflowY: 'auto',
                  borderTop: '1px solid var(--border, #cbd5e1)',
                }}
              >
                <div style={{ fontWeight: 800, color: '#1e3a8a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '1.2rem' }}>℞</span>
                  <span>PRESCRIBED MEDICATIONS:</span>
                </div>
                <div
                  style={{
                    background: '#f8fafc',
                    padding: 8,
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontFamily: 'Consolas, monospace',
                    fontSize: '0.8rem',
                    whiteSpace: 'pre-wrap',
                    marginBottom: 10,
                  }}
                >
                  {prescription || '(No specific prescription text)'}
                </div>

                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#334155', marginBottom: 4 }}>
                  CARE & HOME ADMINISTRATION INSTRUCTIONS:
                </div>
                <div style={{ background: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem', color: '#475569', whiteSpace: 'pre-wrap' }}>
                  {clinicalNotes || '(Standard clinical home care)'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Footer */}
        <footer
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2, #f8fafc)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {/* Quick Copy Action */}
          <button
            type="button"
            className="secondary-btn"
            onClick={handleCopyText}
            style={{
              padding: '8px 12px',
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 44,
            }}
            title="Copy plain prescription text to clipboard"
          >
            {copied ? '✅ Copied!' : '📋 Copy Text'}
          </button>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="small-outline"
              onClick={onClose}
              disabled={isSending}
              style={{ minHeight: 44, padding: '8px 16px', fontSize: '0.85rem' }}
            >
              Cancel
            </button>

            {/* Offline Mail Client Fallback Button */}
            <button
              type="button"
              className="secondary-btn"
              onClick={handleSendMailto}
              disabled={isSending}
              style={{
                minHeight: 44,
                padding: '8px 14px',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
              }}
              title="Open prescription draft in Gmail, Apple Mail, or Outlook"
            >
              <span>📬</span>
              <span>Open in Email App</span>
            </button>

            {/* Cloud Email Dispatch Button */}
            <button
              type="button"
              className="action-btn blue"
              onClick={handleSendCloudEmail}
              disabled={isSending}
              style={{
                minHeight: 44,
                padding: '8px 18px',
                fontSize: '0.86rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                cursor: isSending ? 'not-allowed' : 'pointer',
              }}
            >
              {isSending ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }}></span>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <span>✉️</span>
                  <span>Send Cloud Email</span>
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
