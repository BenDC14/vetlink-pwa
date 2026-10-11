export default function LoginPage({ email, password, setEmail, setPassword, onLogin }) {
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
        <p className="eyebrow">Welcome back</p>
        <p>Sign in to continue managing your clinic and patient care.</p>
      </div>

      <form className="login-form" onSubmit={onLogin}>
        <label>
          <span>Work email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@clinic.com" autoComplete="email" />
        </label>
        <label>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" />
        </label>
        <button className="primary-btn" type="submit">Sign in <span aria-hidden="true">-&gt;</span></button>
      </form>

      <p className="login-note">Access is limited to registered VetLink clinic staff.</p>
    </section>
  )
}
