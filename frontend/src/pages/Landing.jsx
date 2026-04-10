import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const [modal, setModal] = useState(null)
  const navigate = useNavigate()

  const handleLogin = () => {
    // Dummy login action - routes to Home
    navigate('/home')
  }

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
              ? <LoginForm onSwitch={() => setModal('signup')} onSubmit={handleLogin} />
              : <SignupForm onSwitch={() => setModal('login')} onSubmit={handleLogin} />}
          </div>
        </div>
      )}
    </>
  )
}

function LoginForm({ onSwitch, onSubmit }) {
  return (
    <form className="auth-form" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <h2>Log In</h2>
      <label>Email<input type="email" placeholder="you@example.com" /></label>
      <label>Password<input type="password" placeholder="••••••••" /></label>
      <button type="submit" className="btn btn--primary btn--full">Log In</button>
      <p className="auth-switch">No account? <button type="button" className="link-btn" onClick={onSwitch}>Sign up</button></p>
    </form>
  )
}

function SignupForm({ onSwitch, onSubmit }) {
  return (
    <form className="auth-form" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <h2>Sign Up</h2>
      <label>Username<input type="text" placeholder="username" /></label>
      <label>Email<input type="email" placeholder="you@example.com" /></label>
      <label>Password<input type="password" placeholder="••••••••" /></label>
      <button type="submit" className="btn btn--primary btn--full">Create Account</button>
      <p className="auth-switch">Already have one? <button type="button" className="link-btn" onClick={onSwitch}>Log in</button></p>
    </form>
  )
}
