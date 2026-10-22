import { useState } from 'react'

export default function Login({ email, password, setEmail, setPassword, onLogin, onChangePassword }) {
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      if (requiresPasswordChange) {
        if (newPassword !== confirmPassword) throw new Error('The new passwords do not match.')
        await onChangePassword({ currentPassword: password, newPassword })
        setPassword('')
      } else {
        const result = await onLogin({ email, password })
        if (result?.must_change_password) setRequiresPasswordChange(true)
      }
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="login-card">
      <div className="brand-row">
        <div className="brand-mark" aria-label="VetLink">V</div>
        <div>
          <p className="brand-name">VetLink</p>
          <p className="brand-caption">Clinical workspace</p>
        </div>

      </div>

      <div className="hero-copy">
        <p className="eyebrow">{requiresPasswordChange ? 'Set a new password' : 'Welcome back'}</p>
        <p>{requiresPasswordChange ? 'Your temporary password must be replaced before continuing.' : 'Sign in to continue managing your clinic and patient care.'}</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        {!requiresPasswordChange ? (
          <>
            <label>
              <span>Work email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@clinic.com" autoComplete="username" required />
            </label>
            <label>
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
            </label>
            <button className="primary-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'} <span aria-hidden="true">-&gt;</span>
            </button>
          </>
        ) : (
          <>
            <label>
              <span>New password</span>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} required />
            </label>
            <label>
              <span>Confirm new password</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={12} required />
            </label>
            <button className="primary-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating password...' : 'Update password'}
            </button>
          </>
        )}
        {error && <p role="alert" className="login-error">{error}</p>}
      </form>

      <p className="login-note">Access is limited to registered VetLink clinic staff.</p>
    </section>
  )
}