import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'

const MEASUREMENT_FIELDS = [
  { key: 'weight',                   label: 'WEIGHT (kg)',    type: 'number', required: true },
  { key: 'height',                   label: 'HEIGHT (cm)',    type: 'number' },
  { key: 'visual_body_fat_percent',  label: 'BODY FAT (%)',   type: 'number' },
  { key: 'neck_measurement',         label: 'NECK (cm)',      type: 'number' },
  { key: 'shoulder_measurement',     label: 'SHOULDERS (cm)', type: 'number' },
  { key: 'chest_measurement',        label: 'CHEST (cm)',     type: 'number' },
  { key: 'bicep_measurement',        label: 'BICEP (cm)',     type: 'number' },
  { key: 'forearm_measurement',      label: 'FOREARM (cm)',   type: 'number' },
  { key: 'waist_measurement',        label: 'WAIST (cm)',     type: 'number' },
  { key: 'hips_measurement',         label: 'HIPS (cm)',      type: 'number' },
  { key: 'thigh_measurement',        label: 'THIGH (cm)',     type: 'number' },
  { key: 'calve_measurement',        label: 'CALF (cm)',      type: 'number' },
]

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function parseGoalDate(dateStr) {
  const s = String(dateStr).slice(0, 10)
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d, date: new Date(y, m - 1, d) }
}

function formatGoalDate(dateStr) {
  const { y, m, d } = parseGoalDate(dateStr)
  if (!y || !m || !d) return dateStr
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

function isOverdue(dateStr) {
  const { date } = parseGoalDate(dateStr)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return date < today
}

function emptyMeasurement() {
  return Object.fromEntries(MEASUREMENT_FIELDS.map(f => [f.key, '']))
}

export default function Stats() {
  const { user } = useAuth()

  const [measurements, setMeasurements] = useState([])
  const [showMeasureForm, setShowMeasureForm] = useState(false)
  const [measureDraft, setMeasureDraft] = useState(emptyMeasurement)
  const [measureSaving, setMeasureSaving] = useState(false)
  const [measureError, setMeasureError] = useState(null)

  const [goals, setGoals] = useState([])
  const [goalsLoading, setGoalsLoading] = useState(true)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [goalDraft, setGoalDraft] = useState({ description: '', target_date: '' })
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalError, setGoalError] = useState(null)
  const [togglingId, setTogglingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (!user) return
    fetch(`/api/profile/${user.user_id}/measurements`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data.status === 'ok') setMeasurements(data.measurements) })
    setGoalsLoading(true)
    fetch(`/api/stats/${user.user_id}/goals`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data.status === 'ok') setGoals(data.goals) })
      .finally(() => setGoalsLoading(false))
  }, [user])

  async function submitMeasurement(e) {
    e.preventDefault()
    if (!measureDraft.weight) {
      setMeasureError('Weight is required.')
      return
    }
    setMeasureSaving(true)
    setMeasureError(null)
    const body = Object.fromEntries(
      Object.entries(measureDraft)
        .filter(([, v]) => v !== '')
        .map(([k, v]) => [k, Number(v)])
    )
    try {
      const res = await fetch(`/api/profile/${user.user_id}/measurements`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setMeasurements(prev => [data.measurement, ...prev])
        setMeasureDraft(emptyMeasurement())
        setShowMeasureForm(false)
      } else {
        setMeasureError(data.message || 'Failed to save.')
      }
    } catch {
      setMeasureError('Network error.')
    } finally {
      setMeasureSaving(false)
    }
  }

  // ── Goal handlers ──
  async function submitGoal(e) {
    e.preventDefault()
    const desc = goalDraft.description.trim()
    if (!desc) { setGoalError('Description is required.'); return }
    setGoalSaving(true)
    setGoalError(null)
    try {
      const res = await fetch(`/api/stats/${user.user_id}/goals`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: desc,
          target_date: goalDraft.target_date || null,
        }),
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setGoals(prev => [data.goal, ...prev])
        setGoalDraft({ description: '', target_date: '' })
        setShowGoalForm(false)
      } else {
        setGoalError(data.message || 'Failed to save.')
      }
    } catch {
      setGoalError('Network error.')
    } finally {
      setGoalSaving(false)
    }
  }

  async function toggleGoal(goal) {
    setTogglingId(goal.goal_id)
    try {
      const res = await fetch(`/api/stats/${user.user_id}/goals/${goal.goal_id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completion_status: goal.completion_status === 'completed' ? 'in_progress' : 'completed' }),
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setGoals(prev => prev.map(g => g.goal_id === goal.goal_id ? data.goal : g))
      }
    } finally {
      setTogglingId(null)
    }
  }

  async function deleteGoal(goalId) {
    setDeletingId(goalId)
    try {
      const res = await fetch(`/api/stats/${user.user_id}/goals/${goalId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setGoals(prev => prev.filter(g => g.goal_id !== goalId))
      }
    } finally {
      setDeletingId(null)
    }
  }

  const latest = measurements[0] ?? null

  return (
    <Layout title="PERFORMANCE METRICS">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* ── Body Measurements Panel ── */}
        <div className="dashboard-card">
          <div className="flex-header">
            <span className="panel-title">BODY MEASUREMENTS</span>
            <button
              className={showMeasureForm ? 'btn btn--outline' : 'btn btn--accent'}
              style={{ fontSize: 11, padding: '4px 12px' }}
              onClick={() => { setShowMeasureForm(v => !v); setMeasureError(null) }}
            >
              {showMeasureForm ? 'CANCEL' : '+ LOG'}
            </button>
          </div>

          {showMeasureForm && (
            <form onSubmit={submitMeasurement} style={{ marginBottom: 20 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12,
              }}>
                {MEASUREMENT_FIELDS.map(f => (
                  <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                      {f.label}{f.required && <span style={{ color: 'var(--accent)', marginLeft: 2 }}>*</span>}
                    </span>
                    <input
                      className="profile-edit-input"
                      type="number"
                      step="any"
                      min="0"
                      placeholder={f.required ? 'required' : '—'}
                      value={measureDraft[f.key]}
                      onChange={e => setMeasureDraft(d => ({ ...d, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              {measureError && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>
                  {measureError}
                </p>
              )}
              <button
                type="submit"
                className="btn btn--accent"
                style={{ fontSize: 12, padding: '6px 20px' }}
                disabled={measureSaving}
              >
                {measureSaving ? 'SAVING…' : 'SAVE MEASUREMENTS'}
              </button>
            </form>
          )}

          {/* Latest snapshot */}
          {latest ? (
            <>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                LATEST — {new Date(latest.date_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <div className="stats-grid">
                {MEASUREMENT_FIELDS.filter(f => latest[f.key] != null).map(f => (
                  <div key={f.key} className="stat-item">
                    <span className="stat-label">{f.label}</span>
                    <span className="stat-value" style={{ fontSize: 24 }}>{latest[f.key]}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            !showMeasureForm && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', paddingTop: 8 }}>
                No measurements logged yet.
              </p>
            )
          )}
        </div>

        {/* ── Goals Panel ── */}
        <div className="dashboard-card">
          <div className="flex-header">
            <span className="panel-title">GOALS — {goals.length}</span>
            <button
              className={showGoalForm ? 'btn btn--outline' : 'btn btn--accent'}
              style={{ fontSize: 11, padding: '4px 12px' }}
              onClick={() => { setShowGoalForm(v => !v); setGoalError(null) }}
            >
              {showGoalForm ? 'CANCEL' : '+ NEW'}
            </button>
          </div>

          {showGoalForm && (
            <form onSubmit={submitGoal} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>DESCRIPTION</span>
                  <input
                    className="profile-edit-input"
                    type="text"
                    placeholder="e.g. Bench press 100 kg for 5 reps"
                    value={goalDraft.description}
                    onChange={e => setGoalDraft(d => ({ ...d, description: e.target.value }))}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>TARGET DATE (optional)</span>
                  <input
                    className="profile-edit-input"
                    type="date"
                    value={goalDraft.target_date}
                    onChange={e => setGoalDraft(d => ({ ...d, target_date: e.target.value }))}
                  />
                </div>
              </div>
              {goalError && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>
                  {goalError}
                </p>
              )}
              <button
                type="submit"
                className="btn btn--accent"
                style={{ fontSize: 12, padding: '6px 20px' }}
                disabled={goalSaving}
              >
                {goalSaving ? 'SAVING…' : 'ADD GOAL'}
              </button>
            </form>
          )}

          {goalsLoading ? (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>Loading…</p>
          ) : goals.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', paddingTop: 4 }}>
              No goals set yet.
            </p>
          ) : (
            <ul style={{
              listStyle: 'none', padding: 0, margin: 0,
              display: 'flex', flexDirection: 'column', gap: 8,
              maxHeight: 420, overflowY: 'auto',
            }}>
              {goals.map(goal => (
                <li key={goal.goal_id} style={{
                  background: 'var(--bg)',
                  border: `1px solid ${goal.completion_status === 'completed' ? 'var(--border-bright)' : 'var(--border)'}`,
                  padding: '12px 14px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                  opacity: goal.completion_status === 'completed' ? 0.6 : 1,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{
                      fontSize: 14, lineHeight: 1.4, flex: 1,
                      textDecoration: goal.completion_status === 'completed' ? 'line-through' : 'none',
                      color: goal.completion_status === 'completed' ? 'var(--text-muted)' : 'var(--text)',
                    }}>
                      {goal.description}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {goal.completion_status === 'completed'
                        ? <span className="tag border-success">DONE</span>
                        : <span className="tag border-amber">ACTIVE</span>}
                      <button
                        className="btn btn--ghost"
                        style={{ fontSize: 10, padding: '2px 8px', color: 'var(--text-muted)' }}
                        onClick={() => toggleGoal(goal)}
                        disabled={togglingId === goal.goal_id}
                        title={goal.completion_status === 'completed' ? 'Mark in progress' : 'Mark complete'}
                      >
                        {togglingId === goal.goal_id ? '…' : goal.completion_status === 'completed' ? 'UNDO' : '✓'}
                      </button>
                      <button
                        className="btn btn--ghost"
                        style={{ fontSize: 11, padding: '2px 6px', color: 'var(--danger)' }}
                        onClick={() => deleteGoal(goal.goal_id)}
                        disabled={deletingId === goal.goal_id}
                        title="Delete goal"
                      >
                        {deletingId === goal.goal_id ? '…' : '✕'}
                      </button>
                    </div>
                  </div>
                  {goal.target_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: goal.completion_status !== 'completed' && isOverdue(goal.target_date) ? 'var(--danger)' : 'var(--text-muted)' }}>
                        TARGET {formatGoalDate(goal.target_date)}
                      </span>
                      {goal.completion_status !== 'completed' && isOverdue(goal.target_date) && (
                        <span className="tag border-danger">OVERDUE</span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </Layout>
  )
}
