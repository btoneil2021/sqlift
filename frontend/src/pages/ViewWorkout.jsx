import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'

function fmt(val, fallback = '—') {
  if (val === null || val === undefined || val === '') return fallback
  return val
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtSessionLabel(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.getFullYear() === today.getFullYear() &&
                  d.getMonth()    === today.getMonth()    &&
                  d.getDate()     === today.getDate()
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `Today at ${time}`
  return `${fmtDate(iso)} at ${time}`
}

function fmtRest(interval) {
  if (!interval) return null
  // Postgres INTERVAL comes back as e.g. "0:01:30" or "00:01:30"
  const match = String(interval).match(/(\d+):(\d+):(\d+)/)
  if (!match) return interval
  const [, h, m, s] = match
  if (parseInt(h) > 0) return `${parseInt(h)}h ${parseInt(m)}m`
  if (parseInt(m) > 0) return `${parseInt(m)}m ${parseInt(s)}s`
  return `${parseInt(s)}s`
}

export default function ViewWorkout() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [workout, setWorkout]             = useState(null)
  const [inProgress, setInProgress]       = useState(null)
  const [sessions, setSessions]           = useState([])
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [deleting, setDeleting]     = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [starting, setStarting]     = useState(false)
  const [startError, setStartError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      fetch(`/api/workouts/${id}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/workouts/${id}/sessions/in-progress`, { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/workouts/${id}/sessions`, { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([workoutData, ipData, sessionsData]) => {
        if (workoutData.status !== 'ok') {
          setError(workoutData.message || 'Workout not found.')
        } else {
          setWorkout(workoutData.workout)
          if (ipData.status === 'ok') setInProgress(ipData.session)
          if (sessionsData.status === 'ok') setSessions(sessionsData.sessions)
        }
      })
      .catch(() => setError('Network error.'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleStartSession() {
    setStarting(true)
    setStartError(null)
    try {
      const res = await fetch(`/api/workouts/${id}/sessions`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.status === 'ok') {
        navigate(`/session/${data.workout_session_id}`)
      } else {
        setStartError(data.message || 'Failed to start session.')
      }
    } catch {
      setStartError('Network error.')
    } finally {
      setStarting(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${workout.header.name}"? This cannot be undone.`)) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/workouts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.status === 'ok') {
        navigate('/home')
      } else {
        setDeleteError(data.message || 'Delete failed.')
      }
    } catch {
      setDeleteError('Network error.')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <Layout title="WORKOUT">
        <div className="dashboard-card">
          <p className="data-monospace text-muted">LOADING...</p>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout title="WORKOUT">
        <div className="dashboard-card">
          <p className="data-monospace" style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</p>
          <Link to="/home" className="btn btn--outline btn--sm">← Back to Home</Link>
        </div>
      </Layout>
    )
  }

  const { header, tags, exercises, history } = workout
  const hasInProgress = !!inProgress

  return (
    <Layout title={header.name.toUpperCase()}>

      {/* ── Header module ── */}
      <div className="dashboard-card" style={{ marginBottom: 24 }}>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <div>
            <span className="stat-label">PREFERRED DAY</span>
            <span className="data-monospace" style={{ fontSize: 14, color: 'var(--text)', display: 'block', marginTop: 2 }}>
              {fmt(header.preferred_day)}
            </span>
          </div>
          <div>
            <span className="stat-label">PRIMARY MUSCLE</span>
            <span className="data-monospace" style={{ fontSize: 14, color: 'var(--text)', display: 'block', marginTop: 2 }}>
              {fmt(header.primary_muscle_group)}
            </span>
          </div>
          {tags && tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {tags.map(t => (
                <span key={t.tag_name} className="tag" style={{ backgroundColor: `#${t.color_code}`, borderColor: `#${t.color_code}`, color: '#fff' }}>{t.tag_name}</span>
              ))}
            </div>
          )}
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="btn btn--accent"
            style={{ fontSize: 15, padding: '10px 20px', fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}
            onClick={handleStartSession}
            disabled={starting}
          >
            {starting ? 'STARTING...' : hasInProgress ? 'RESUME SESSION ↗' : 'START SESSION ↗'}
          </button>

          <Link
            to={`/workout/new?edit=${id}`}
            className="btn btn--outline btn--sm"
          >
            EDIT
          </Link>

          <button
            className="btn btn--ghost btn--sm"
            style={{ color: 'var(--danger)', marginLeft: 'auto' }}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'DELETING...' : 'DELETE'}
          </button>
        </div>

        {startError && (
          <p className="data-monospace" style={{ color: 'var(--danger)', fontSize: 12, marginTop: 10 }}>
            {startError}
          </p>
        )}

        {deleteError && (
          <p className="data-monospace" style={{ color: 'var(--danger)', fontSize: 12, marginTop: 10 }}>
            {deleteError}
          </p>
        )}

        {hasInProgress && (
          <p className="data-monospace" style={{ color: 'var(--accent)', fontSize: 11, marginTop: 10 }}>
            ● SESSION IN PROGRESS — started {fmtDate(inProgress.start_date_time)}
          </p>
        )}
      </div>

      {/* ── Exercise plan ── */}
      <div className="dashboard-card" style={{ marginBottom: 24 }}>
        <div className="panel-title">EXERCISE PLAN</div>

        {!exercises || exercises.length === 0 ? (
          <p className="data-monospace text-muted" style={{ fontSize: 12 }}>No exercises in this workout.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {exercises.map(ex => (
              <div key={ex.sort_order} className="exercise-row">
                <span className="exercise-row__num">{String(ex.sort_order).padStart(2, '0')}</span>
                <span className="exercise-row__name">{ex.exercise_name}</span>
                <div className="exercise-row__meta">
                  {(ex.target_sets || ex.target_reps) && (
                    <span>
                      {ex.target_sets ?? '—'} × {ex.target_reps ?? '—'} reps
                      {ex.target_weight ? ` @ ${ex.target_weight} kg` : ''}
                    </span>
                  )}
                  {ex.expected_rest_time && (
                    <span>rest {fmtRest(ex.expected_rest_time)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Session history ── */}
      <div className="dashboard-card">
        <div className="panel-title">SESSION HISTORY</div>

        {!history || history.total_sessions === 0 ? (
          <p className="data-monospace text-muted" style={{ fontSize: 12 }}>No sessions recorded yet.</p>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">TOTAL SESSIONS</span>
                <span className="stat-value text-accent">{history.total_sessions}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">COMPLETED</span>
                <span className="stat-value text-success">{history.completed_sessions}</span>
              </div>
              {history.in_progress_sessions > 0 && (
                <div className="stat-item">
                  <span className="stat-label">IN PROGRESS</span>
                  <span className="stat-value" style={{ color: 'var(--accent)' }}>{history.in_progress_sessions}</span>
                </div>
              )}
              <div className="stat-item">
                <span className="stat-label">LAST STARTED</span>
                <span className="data-monospace" style={{ fontSize: 14, marginTop: 4 }}>{fmtDate(history.last_started_at)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">LAST COMPLETED</span>
                <span className="data-monospace" style={{ fontSize: 14, marginTop: 4 }}>{fmtDate(history.last_completed_at)}</span>
              </div>
            </div>

            {(history.average_difficulty || history.average_enjoyment || history.average_energy_level) && (
              <div className="stats-grid" style={{ marginTop: 12 }}>
                {history.average_difficulty != null && (
                  <div className="stat-item">
                    <span className="stat-label">AVG DIFFICULTY</span>
                    <span className="data-monospace text-muted" style={{ fontSize: 18, marginTop: 4 }}>{history.average_difficulty} / 10</span>
                  </div>
                )}
                {history.average_enjoyment != null && (
                  <div className="stat-item">
                    <span className="stat-label">AVG ENJOYMENT</span>
                    <span className="data-monospace text-muted" style={{ fontSize: 18, marginTop: 4 }}>{history.average_enjoyment} / 10</span>
                  </div>
                )}
                {history.average_energy_level != null && (
                  <div className="stat-item">
                    <span className="stat-label">AVG ENERGY</span>
                    <span className="data-monospace text-muted" style={{ fontSize: 18, marginTop: 4 }}>{history.average_energy_level} / 10</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Session log ── */}
      {sessions.length > 0 && (() => {
        const displayed = showAllSessions ? sessions : sessions.slice(0, 10)
        return (
          <div className="dashboard-card" style={{ marginTop: 24 }}>
            <div className="panel-title">SESSION LOG</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {displayed.map((s, i) => {
                const isInProgress = s.completion_status === 'In Progress'
                const isAbandoned  = !isInProgress && s.notes === 'Abandoned'
                return (
                  <Link
                    key={s.workout_session_id}
                    to={`/session/${s.workout_session_id}`}
                    className="exercise-row"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <span className="exercise-row__num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="exercise-row__name" style={{ fontSize: 14 }}>
                      {fmtSessionLabel(s.start_date_time)}
                    </span>
                    <div className="exercise-row__meta" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="data-monospace text-muted" style={{ fontSize: 12 }}>
                        {s.exercise_count} {s.exercise_count === 1 ? 'exercise' : 'exercises'}
                      </span>
                      {isInProgress && <span className="pill pill--warning">IN PROGRESS</span>}
                      {isAbandoned   && <span className="pill pill--danger">ABANDONED</span>}
                      {!isInProgress && !isAbandoned && <span className="pill pill--success">COMPLETED</span>}
                    </div>
                  </Link>
                )
              })}
            </div>
            {sessions.length > 10 && (
              <button
                className="btn btn--ghost btn--sm"
                style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}
                onClick={() => setShowAllSessions(v => !v)}
              >
                {showAllSessions ? '— SHOW LESS' : `+ SHOW ALL ${sessions.length}`}
              </button>
            )}
          </div>
        )
      })()}

    </Layout>
  )
}
