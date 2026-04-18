import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'

function asUTC(iso) {
  if (!iso) return null
  const s = String(iso).replace(' ', 'T')
  return s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s) ? s : s + 'Z'
}

function fmtLastRan(iso) {
  if (!iso) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const then  = new Date(asUTC(iso)); then.setHours(0, 0, 0, 0)
  const days  = Math.round((today - then) / 86400000)
  if (days === 0) return 'TODAY'
  if (days === 1) return '1 DAY AGO'
  if (days < 7) return `${days} DAYS AGO`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return '1 WEEK AGO'
  if (weeks < 5) return `${weeks} WEEKS AGO`
  return new Date(asUTC(iso)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
}

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [workouts, setWorkouts] = useState([])
  const [loadingWorkouts, setLoadingWorkouts] = useState(true)
  const [workoutsError, setWorkoutsError] = useState(null)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [streakLoading, setStreakLoading] = useState(true)
  const [totalVolume, setTotalVolume] = useState(0)
  const [volumeLoading, setVolumeLoading] = useState(true)
  const [avgSessionMinutes, setAvgSessionMinutes] = useState(0)

  useEffect(() => {
    if (!user) return
    fetch(`/api/stats/${user.user_id}/workout-history`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'ok') setCurrentStreak(data.current_streak ?? 0)
      })
      .finally(() => setStreakLoading(false))

    fetch(`/api/stats/${user.user_id}/hero-stats`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'ok' && data.stats) {
          setTotalVolume(data.stats.total_volume_kg ?? 0)
          setAvgSessionMinutes(data.stats.avg_session_minutes ?? 0)
        }
      })
      .finally(() => setVolumeLoading(false))
  }, [user])

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
              <span className="stat-label">TOTAL SESSIONS</span>
              <span className="stat-value">
                {loadingWorkouts
                  ? '—'
                  : String(workouts.reduce((s, w) => s + (w.total_sessions || 0), 0)).padStart(3, '0')}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">CURRENT STREAK</span>
              <span className="stat-value" style={{ color: currentStreak > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                {streakLoading ? '—' : currentStreak}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>days</span>
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">TOTAL VOLUME</span>
              <span className="stat-value">
                {volumeLoading ? '—' : totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>kg</span>
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">AVG SESSION</span>
              <span className="stat-value">
                {volumeLoading ? '—' : avgSessionMinutes}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>min</span>
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
                        {(w.name || 'UNNAMED').toUpperCase()}
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
