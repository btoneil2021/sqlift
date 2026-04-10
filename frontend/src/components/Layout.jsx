import { Link } from 'react-router-dom'

export default function Layout({ title, children }) {
  return (
    <div className="page-layout">
      <nav className="nav nav-internal">
        <Link to="/home" className="logo"><span className="logo-sql">SQL</span><span className="logo-ift">ift</span></Link>
        <div className="nav-links">
          <Link to="/home" className="nav-link">Home</Link>
          <Link to="/profile" className="nav-link">Profile</Link>
          <Link to="/stats" className="nav-link">Stats</Link>
          <Link to="/leaderboard" className="nav-link">Leaderboard</Link>
          <Link to="/" className="btn btn--ghost">Log Out</Link>
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
