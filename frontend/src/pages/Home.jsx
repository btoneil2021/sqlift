import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'

function fmtLastRan(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'TODAY'
  if (days === 1) return '1 DAY AGO'
  if (days < 7) return `${days} DAYS AGO`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return '1 WEEK AGO'
  if (weeks < 5) return `${weeks} WEEKS AGO`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
}

export default function Home() {
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState([])
  const [loadingWorkouts, setLoadingWorkouts] = useState(true)
  const [workoutsError, setWorkoutsError] = useState(null)

  useEffect(() => {
    fetch('/api/workouts/list', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'ok') {
          setWorkouts(data.workouts || [])
        } else {
          setWorkoutsError(data.message || 'Failed to load workouts.')
        }
      })
      .catch(() => setWorkoutsError('Network error.'))
      .finally(() => setLoadingWorkouts(false))
  }, [])

  async function handleEngage(workoutId) {
    const res = await fetch(`/api/workouts/${workoutId}/sessions`, {
      method: 'POST',
      credentials: 'include',
    })
    const data = await res.json()
    if (data.status === 'ok') {
      navigate(`/session/${data.workout_session_id}`)
    }
  }

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
              <span className="stat-label">SAVED WORKOUTS</span>
              <span className="stat-value text-accent">
                {loadingWorkouts ? '—' : String(workouts.length).padStart(3, '0')}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">TOTAL SESSIONS</span>
              <span className="stat-value">
                {loadingWorkouts
                  ? '—'
                  : String(workouts.reduce((s, w) => s + (w.total_sessions || 0), 0)).padStart(3, '0')}
              </span>
            </div>
          </div>
          <Link to="/stats" className="btn btn--ghost btn--full mt-auto">View Full Telemetry »</Link>
        </section>

        {/* Saved Programs */}
        <section className="dashboard-card full-width">
          <div className="flex-header">
            <h2 className="panel-title">SAVED PROGRAMS</h2>
          </div>

          {loadingWorkouts && (
            <p className="data-monospace text-muted" style={{ fontSize: 12 }}>LOADING...</p>
          )}

          {workoutsError && (
            <p className="data-monospace" style={{ color: 'var(--danger)', fontSize: 12 }}>{workoutsError}</p>
          )}

          {!loadingWorkouts && !workoutsError && workouts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p className="data-monospace text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
                NO PROGRAMS FOUND — DEPLOY YOUR FIRST WORKOUT.
              </p>
              <Link to="/workout/new" className="btn btn--outline">Create Workout</Link>
            </div>
          )}

          {!loadingWorkouts && workouts.length > 0 && (
            <ul className="workout-list">
              {workouts.map(w => {
                const lastRan = fmtLastRan(w.last_started_at)
                return (
                  <li key={w.workout_id} className="workout-row">
                    <div className="workout-info">
                      <h3>
                        {w.name.toUpperCase()}
                        {w.primary_muscle_group && (
                          <span className="tag border-amber">{w.primary_muscle_group.toUpperCase()}</span>
                        )}
                        {w.tags && w.tags.map(t => (
                          <span key={t.tag_name} className="tag border-slate">{t.tag_name}</span>
                        ))}
                      </h3>
                      <span className="data-monospace text-muted">
                        {lastRan
                          ? `LAST RAN: ${lastRan}`
                          : w.total_sessions > 0
                            ? `${w.total_sessions} SESSION${w.total_sessions !== 1 ? 'S' : ''}`
                            : 'NOT STARTED'}
                        {w.preferred_day ? ` · ${w.preferred_day.toUpperCase()}` : ''}
                      </span>
                    </div>
                    <div className="workout-actions">
                      <Link to={`/workout/${w.workout_id}`} className="btn btn--outline btn--sm">Inspect</Link>
                      <button
                        className="btn btn--accent btn--sm"
                        onClick={() => handleEngage(w.workout_id)}
                      >
                        Engage
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  )
}
