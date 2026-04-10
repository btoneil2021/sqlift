import { Link } from 'react-router-dom'
import Layout from '../components/Layout'

export default function Home() {
  return (
    <Layout title="COMMAND CENTER">
      <div className="home-grid">
        
        {/* Quick Actions Block */}
        <section className="dashboard-card action-panel">
          <h2 className="panel-title">OPERATIONS</h2>
          <div className="action-buttons">
            <Link to="/workout/new" className="btn btn--primary btn--massive">
              Deploy New Workout <span className="arrow">↗</span>
            </Link>
            <Link to="/profile" className="btn btn--outline">
              User Profile
            </Link>
          </div>
        </section>

        {/* Global Stats Block */}
        <section className="dashboard-card stats-panel">
          <h2 className="panel-title">TELEMETRY</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">TOTAL SESSIONS</span>
              <span className="stat-value text-accent">042</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">LIFT VOLUME</span>
              <span className="stat-value">12.4k<span className="data-monospace">KG</span></span>
            </div>
            <div className="stat-item">
              <span className="stat-label">RANKING</span>
              <span className="stat-value text-success">#03</span>
            </div>
          </div>
          <Link to="/stats" className="btn btn--ghost btn--full mt-auto">View Full Telemetry »</Link>
        </section>

        {/* Recent Workouts List */}
        <section className="dashboard-card full-width">
          <div className="flex-header">
            <h2 className="panel-title">SAVED PROGRAMS</h2>
            <Link to="/exercise/1" className="link-btn text-muted">Exercise Library</Link>
          </div>
          
          <ul className="workout-list">
            <li className="workout-row">
              <div className="workout-info">
                <h3>PUSH DAY <span className="tag border-amber">CHEST</span></h3>
                <span className="data-monospace text-muted">LAST RAN: 2 DAYS AGO</span>
              </div>
              <div className="workout-actions">
                <Link to="/workout/1" className="btn btn--outline">Inspect</Link>
                <Link to="/session/1" className="btn btn--accent">Engage</Link>
              </div>
            </li>
            
            <li className="workout-row">
              <div className="workout-info">
                <h3>PULL DAY <span className="tag border-slate">BACK</span></h3>
                <span className="data-monospace text-muted">LAST RAN: 4 DAYS AGO</span>
              </div>
              <div className="workout-actions">
                <Link to="/workout/2" className="btn btn--outline">Inspect</Link>
                <Link to="/session/2" className="btn btn--accent">Engage</Link>
              </div>
            </li>
            
            <li className="workout-row">
              <div className="workout-info">
                <h3>LEG DAY <span className="tag border-danger">LOWER</span></h3>
                <span className="data-monospace text-muted">LAST RAN: 1 WEEK AGO</span>
              </div>
              <div className="workout-actions">
                <Link to="/workout/3" className="btn btn--outline">Inspect</Link>
                <Link to="/session/3" className="btn btn--accent">Engage</Link>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </Layout>
  )
}
