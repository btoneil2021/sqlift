import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout({ title, children }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <div className="page-layout">
      <nav className="nav nav-internal">
        <Link to="/home" className="logo"><span className="logo-sql">SQL</span><span className="logo-ift">ift</span></Link>
        <div className="nav-links">
          <Link to="/home" className="nav-link">Home</Link>
          <Link to="/profile" className="nav-link">Profile</Link>
          <Link to="/stats" className="nav-link">Stats</Link>
          <Link to="/leaderboard" className="nav-link">Leaderboard</Link>
          <button className="btn btn--ghost" onClick={handleLogout}>Log Out</button>
        </div>
      </nav>
      <main className="page-content">
        <div className="page-header">
          <h1>{title}</h1>
        </div>
        {children}
      </main>
    </div>
  )
}
