export default function LoginPage({ email, password, setEmail, setPassword, onLogin }) {
  return (
    <section className="login-card">
      <div className="brand-row">
        <div className="brand-badge">VetLink</div>
        <span className="pill">Secure portal</span>
      </div>

      <div className="hero-copy">
        <h1>Welcome back</h1>
        <p>Sign in to continue your veterinary skin assessment workflow.</p>
      </div>

      <form className="login-form" onSubmit={onLogin}>
        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@clinic.com" />
        </label>
        <label>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>
        <button className="primary-btn" type="submit">Log in</button>
      </form>
    </section>
  )
}
