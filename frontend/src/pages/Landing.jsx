import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Landing() {
  const [modal, setModal] = useState(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (user) navigate('/home', { replace: true })
  }, [user, navigate])

  return (
    <>
      <nav className="nav">
        <span className="logo"><span className="logo-sql">SQL</span><span className="logo-ift">ift</span></span>
        <div>
          <button className="btn btn--ghost" onClick={() => setModal('login')}>Log In</button>
          <button className="btn btn--primary" onClick={() => setModal('signup')}>Sign Up</button>
        </div>
      </nav>

      <main className="hero">
        <h1 className="hero-title">Track your workouts.</h1>
        <p className="hero-subtitle">Log sets, track PRs, and see your progress over time.</p>
        <button className="btn btn--primary btn--large" onClick={() => setModal('signup')}>Get Started</button>
      </main>

      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            {modal === 'login'
              ? <LoginForm onSwitch={() => setModal('signup')} />
              : <SignupForm onSwitch={() => setModal('login')} />}
          </div>
        </div>
      )}
    </>
  )
}

function LoginForm({ onSwitch }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(identifier, password)
    setLoading(false)
    if (result.ok) {
      navigate('/home')
    } else {
      setError(result.message)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Log In</h2>
      <label>Username or Email<input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="username or you@example.com" required /></label>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required /></label>
      {error && <p className="profile-pw-error">{error}</p>}
      <button type="submit" className="btn btn--primary btn--full" disabled={loading}>{loading ? 'Logging in...' : 'Log In'}</button>
      <p className="auth-switch">No account? <button type="button" className="link-btn" onClick={onSwitch}>Sign up</button></p>
    </form>
  )
}

function SignupForm({ onSwitch }) {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [fields, setFields] = useState({ username: '', email: '', password: '', first_name: '', last_name: '', phone_num: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(key) {
    return e => setFields(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signup(fields)
    setLoading(false)
    if (result.ok) {
      navigate('/home')
    } else {
      setError(result.message)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Sign Up</h2>
      <label>First Name<input type="text" value={fields.first_name} onChange={set('first_name')} placeholder="Jane" required /></label>
      <label>Last Name<input type="text" value={fields.last_name} onChange={set('last_name')} placeholder="Doe" required /></label>
      <label>Username<input type="text" value={fields.username} onChange={set('username')} placeholder="username" required /></label>
      <label>Email<input type="email" value={fields.email} onChange={set('email')} placeholder="you@example.com" required /></label>
      <label>Phone<input type="tel" value={fields.phone_num} onChange={set('phone_num')} placeholder="+1 555 000 0000" required /></label>
      <label>Password<input type="password" value={fields.password} onChange={set('password')} placeholder="Min. 6 characters" required /></label>
      {error && <p className="profile-pw-error">{error}</p>}
      <button type="submit" className="btn btn--primary btn--full" disabled={loading}>{loading ? 'Creating account...' : 'Create Account'}</button>
      <p className="auth-switch">Already have one? <button type="button" className="link-btn" onClick={onSwitch}>Log in</button></p>
    </form>
  )
}
