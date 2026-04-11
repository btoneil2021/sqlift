import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'

const W = 240, H = 100, PAD = { top: 10, right: 10, bottom: 24, left: 36 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

function Sparkline({ data, label }) {
  const [tooltip, setTooltip] = useState(null)
  const svgRef = useRef(null)

  if (!data || data.length < 2) return null

  const values = data.map(d => d.value)
  const times  = data.map(d => d.ts)
  const minV = Math.min(...values), maxV = Math.max(...values)
  const minT = Math.min(...times),  maxT = Math.max(...times)

  const rangeV = maxV - minV || 1
  const rangeT = maxT - minT || 1

  const toX = ts  => ((ts - minT) / rangeT) * INNER_W
  const toY = val => INNER_H - ((val - minV) / rangeV) * INNER_H

  const pts = data.map(d => ({ x: toX(d.ts), y: toY(d.value), ...d }))
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')

  // area fill path
  const areaPath =
    `M${pts[0].x},${INNER_H} ` +
    pts.map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${pts[pts.length - 1].x},${INNER_H} Z`

  // y-axis ticks (3 levels)
  const yTicks = [minV, minV + rangeV / 2, maxV].map(v => ({
    v, y: toY(v),
    label: Number.isInteger(v) ? v : v.toFixed(1),
  }))

  // x-axis ticks (first and last)
  const xTicks = [data[0], data[data.length - 1]].map(d => ({
    x: toX(d.ts),
    label: new Date(d.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  const delta = values[values.length - 1] - values[0]
  const deltaColor = delta > 0 ? 'var(--accent)' : delta < 0 ? 'var(--danger)' : 'var(--text-muted)'
  const deltaStr = (delta > 0 ? '+' : '') + (Number.isInteger(delta) ? delta : delta.toFixed(1))

  const latest = pts[pts.length - 1]

  function handleMouseMove(e) {
    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left - PAD.left) * (INNER_W / (rect.width - PAD.left - PAD.right))
    let closest = pts[0], minDist = Infinity
    for (const p of pts) {
      const dist = Math.abs(p.x - mouseX)
      if (dist < minDist) { minDist = dist; closest = p }
    }
    setTooltip(closest)
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: deltaColor }}>
          {deltaStr}
        </span>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* grid lines */}
          {yTicks.map((t, i) => (
            <line key={i} x1={0} y1={t.y} x2={INNER_W} y2={t.y}
              stroke="var(--border)" strokeWidth={1} />
          ))}

          {/* area fill */}
          <defs>
            <linearGradient id={`grad-${label.replace(/\s/g,'')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#grad-${label.replace(/\s/g,'')})`} />

          {/* line */}
          <polyline
            points={polyline}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* latest dot */}
          <circle cx={latest.x} cy={latest.y} r={3} fill="var(--accent)" />
          <circle cx={latest.x} cy={latest.y} r={5} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.4} />

          {/* tooltip dot */}
          {tooltip && tooltip !== latest && (
            <circle cx={tooltip.x} cy={tooltip.y} r={3} fill="var(--text-muted)" />
          )}

          {/* y-axis labels */}
          {yTicks.map((t, i) => (
            <text key={i} x={-6} y={t.y + 3.5}
              fontFamily="var(--font-mono)" fontSize={8} fill="var(--text-muted)"
              textAnchor="end">
              {t.label}
            </text>
          ))}

          {/* x-axis labels */}
          {xTicks.map((t, i) => (
            <text key={i} x={t.x} y={INNER_H + 16}
              fontFamily="var(--font-mono)" fontSize={8} fill="var(--text-muted)"
              textAnchor={i === 0 ? 'start' : 'end'}>
              {t.label}
            </text>
          ))}
        </g>
      </svg>

      {/* tooltip bubble */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          top: PAD.top,
          left: `calc(${(tooltip.x / INNER_W) * 100}% + ${PAD.left}px)`,
          transform: tooltip.x > INNER_W / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-bright)',
          padding: '4px 8px',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>
            {new Date(tooltip.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', display: 'block' }}>
            {Number.isInteger(tooltip.value) ? tooltip.value : tooltip.value.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Time range helpers ─────────────────────────────────────────────────────
const RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'ALL', days: Infinity },
]

function filterByRange(measurements, days) {
  if (days === Infinity) return measurements
  const cutoff = Date.now() - days * 86400 * 1000
  return measurements.filter(m => new Date(m.date_time).getTime() >= cutoff)
}

function buildSeriesData(measurements, fieldKey) {
  return measurements
    .filter(m => m[fieldKey] != null)
    .map(m => ({ ts: new Date(m.date_time).getTime(), value: Number(m[fieldKey]) }))
    .sort((a, b) => a.ts - b.ts)
}

const MEASUREMENT_FIELDS = [
  { key: 'weight',                   label: 'WEIGHT (kg)',    type: 'number', required: true },
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
    if (user.height != null) body.height = Number(user.height)
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
  const [activeRange, setActiveRange] = useState('3M')
  const [visibleKeys, setVisibleKeys] = useState(null) // null = show all
  const [showChartFilter, setShowChartFilter] = useState(false)

  const activeDays = RANGES.find(r => r.label === activeRange)?.days ?? 90
  const rangedMeasurements = filterByRange(measurements, activeDays)

  const chartFields = MEASUREMENT_FIELDS.filter(f => {
    const series = buildSeriesData(rangedMeasurements, f.key)
    return series.length >= 2
  })

  const showFilter = chartFields.length > 3
  const displayedFields = !showFilter
    ? chartFields
    : visibleKeys === null
      ? chartFields.slice(0, 3)
      : chartFields.filter(f => visibleKeys.has(f.key))

  function toggleKey(key) {
    setVisibleKeys(prev => {
      const base = prev ?? new Set(chartFields.slice(0, 3).map(f => f.key))
      const next = new Set(base)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const activeKeys = visibleKeys ?? new Set(chartFields.slice(0, 3).map(f => f.key))

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

      <div className="dashboard-card" style={{ marginTop: 24, gridColumn: '1 / -1' }}>
        <div className="flex-header" style={{ marginBottom: showFilter ? 0 : 16 }}>
          <span className="panel-title">PROGRESSION</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {showFilter && (
              <button
                onClick={() => setShowChartFilter(v => !v)}
                className={showChartFilter ? 'btn btn--accent' : 'btn btn--outline'}
                style={{ fontSize: 10, padding: '3px 12px', letterSpacing: '0.06em', marginRight: 8, borderStyle: showChartFilter ? undefined : 'dashed' }}
              >
                ⊞ METRICS {activeKeys.size}/{chartFields.length}
              </button>
            )}
            {RANGES.map(r => (
              <button
                key={r.label}
                onClick={() => setActiveRange(r.label)}
                className={activeRange === r.label ? 'btn btn--accent' : 'btn btn--outline'}
                style={{ fontSize: 10, padding: '3px 10px', letterSpacing: '0.05em' }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {showFilter && showChartFilter && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6,
            padding: '12px 0 16px',
            borderBottom: '1px solid var(--border)',
            marginBottom: 16,
          }}>
            {chartFields.map(f => {
              const on = activeKeys.has(f.key)
              return (
                <button
                  key={f.key}
                  onClick={() => toggleKey(f.key)}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    padding: '3px 10px',
                    letterSpacing: '0.05em',
                    background: on ? 'var(--accent-glow)' : 'var(--bg)',
                    border: `1px solid ${on ? 'var(--accent)' : 'var(--border-bright)'}`,
                    color: on ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    borderRadius: 2,
                  }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        )}

        {!showFilter && <div style={{ marginBottom: 16 }} />}

        {measurements.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
            No measurements logged yet.
          </p>
        ) : chartFields.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
            Not enough data in this range — log a second measurement to see progression.
          </p>
        ) : displayedFields.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
            No metrics selected — use the filter to pick what to display.
          </p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 20,
          }}>
            {displayedFields.map(f => (
              <div key={f.key} style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                padding: '14px 16px',
              }}>
                <Sparkline
                  data={buildSeriesData(rangedMeasurements, f.key)}
                  label={f.label}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
