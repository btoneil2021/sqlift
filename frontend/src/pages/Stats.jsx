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

// ── Wider sparkline for exercise progression ──────────────────────────────
const EW = 600, EH = 140, EPAD = { top: 12, right: 16, bottom: 28, left: 44 }
const EINNER_W = EW - EPAD.left - EPAD.right
const EINNER_H = EH - EPAD.top - EPAD.bottom

function ExerciseSparkline({ data, label }) {
  const [tooltip, setTooltip] = useState(null)
  const svgRef = useRef(null)

  if (!data || data.length < 2) return null

  const values = data.map(d => d.value)
  const times  = data.map(d => d.ts)
  const minV = Math.min(...values), maxV = Math.max(...values)
  const minT = Math.min(...times),  maxT = Math.max(...times)
  const rangeV = maxV - minV || 1
  const rangeT = maxT - minT || 1

  const toX = ts  => ((ts - minT) / rangeT) * EINNER_W
  const toY = val => EINNER_H - ((val - minV) / rangeV) * EINNER_H

  const pts = data.map(d => ({ x: toX(d.ts), y: toY(d.value), ...d }))
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const areaPath =
    `M${pts[0].x},${EINNER_H} ` +
    pts.map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${pts[pts.length - 1].x},${EINNER_H} Z`

  const yTicks = [minV, minV + rangeV / 2, maxV].map(v => ({
    v, y: toY(v),
    label: Number.isInteger(v) ? v : v.toFixed(1),
  }))
  const xTicks = [data[0], data[Math.floor(data.length / 2)], data[data.length - 1]].map(d => ({
    x: toX(d.ts),
    label: new Date(d.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
  }))

  const delta = values[values.length - 1] - values[0]
  const deltaColor = delta > 0 ? 'var(--accent)' : delta < 0 ? 'var(--danger)' : 'var(--text-muted)'
  const deltaStr = (delta > 0 ? '+' : '') + (Number.isInteger(delta) ? delta : delta.toFixed(1)) + ' kg'

  function handleMouseMove(e) {
    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left - EPAD.left) * (EINNER_W / (rect.width - EPAD.left - EPAD.right))
    let closest = pts[0], minDist = Infinity
    for (const p of pts) {
      const dist = Math.abs(p.x - mouseX)
      if (dist < minDist) { minDist = dist; closest = p }
    }
    setTooltip(closest)
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: deltaColor }}>
          {deltaStr}
        </span>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${EW} ${EH}`}
        style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <g transform={`translate(${EPAD.left},${EPAD.top})`}>
          {yTicks.map((t, i) => (
            <line key={i} x1={0} y1={t.y} x2={EINNER_W} y2={t.y}
              stroke="var(--border)" strokeWidth={1} />
          ))}
          <defs>
            <linearGradient id="grad-exercise" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#grad-exercise)" />
          <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* dots for each data point */}
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4 : 2.5}
              fill={i === pts.length - 1 ? 'var(--accent)' : 'var(--surface-2)'}
              stroke="var(--accent)" strokeWidth={1.5} />
          ))}
          {tooltip && (
            <circle cx={tooltip.x} cy={tooltip.y} r={5} fill="none" stroke="var(--accent)" strokeWidth={1.5} opacity={0.7} />
          )}

          {yTicks.map((t, i) => (
            <text key={i} x={-8} y={t.y + 4}
              fontFamily="var(--font-mono)" fontSize={9} fill="var(--text-muted)" textAnchor="end">
              {t.label}
            </text>
          ))}
          {xTicks.map((t, i) => (
            <text key={i} x={t.x} y={EINNER_H + 18}
              fontFamily="var(--font-mono)" fontSize={9} fill="var(--text-muted)"
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}>
              {t.label}
            </text>
          ))}
        </g>
      </svg>

      {tooltip && (
        <div style={{
          position: 'absolute',
          top: EPAD.top,
          left: `calc(${(tooltip.x / EINNER_W) * 100}% + ${EPAD.left}px)`,
          transform: tooltip.x > EINNER_W / 2 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-bright)',
          padding: '5px 10px',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>
            {new Date(tooltip.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--text)', display: 'block' }}>
            {Number.isInteger(tooltip.value) ? tooltip.value : tooltip.value.toFixed(1)} kg
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

const CAL_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function WorkoutCalendar({ sessions }) {
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth()) // 0-based
  const [selectedDate, setSelectedDate] = useState(null)

  const sessionMap = {}
  for (const s of sessions) {
    const dateKey = s.start_date_time.slice(0, 10)
    if (!sessionMap[dateKey]) sessionMap[dateKey] = []
    sessionMap[dateKey].push(s)
  }

  const firstDay = new Date(calYear, calMonth, 1)
  const lastDay = new Date(calYear, calMonth + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7 // Mon start
  const daysInMonth = lastDay.getDate()

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
    setSelectedDate(null)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
    setSelectedDate(null)
  }

  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()

  const selectedKey = selectedDate
    ? `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`
    : null
  const selectedSessions = selectedKey ? (sessionMap[selectedKey] || []) : []

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button
          className="btn btn--outline"
          style={{ fontSize: 10, padding: '3px 12px' }}
          onClick={prevMonth}
        >
          ‹ PREV
        </button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', letterSpacing: '0.08em' }}>
          {monthLabel}
        </span>
        <button
          className="btn btn--outline"
          style={{ fontSize: 10, padding: '3px 12px' }}
          onClick={nextMonth}
        >
          NEXT ›
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {CAL_DAYS.map(d => (
          <div key={d} style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
            textAlign: 'center', padding: '4px 0', letterSpacing: '0.04em',
          }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />
          const dateKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const hasWorkout = !!sessionMap[dateKey]
          const isToday = dateKey === todayKey
          const isSelected = selectedDate === day
          return (
            <button
              key={dateKey}
              onClick={() => setSelectedDate(isSelected ? null : day)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                padding: '6px 2px',
                textAlign: 'center',
                background: isSelected
                  ? 'var(--accent)'
                  : hasWorkout
                    ? 'var(--accent-glow)'
                    : 'var(--bg)',
                border: isToday
                  ? '1px solid var(--accent)'
                  : isSelected
                    ? '1px solid var(--accent)'
                    : hasWorkout
                      ? '1px solid var(--border-bright)'
                      : '1px solid var(--border)',
                color: isSelected ? '#000' : hasWorkout ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                borderRadius: 2,
                position: 'relative',
              }}
            >
              {day}
              {hasWorkout && !isSelected && (
                <span style={{
                  position: 'absolute',
                  bottom: 2,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'block',
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Selected date detail */}
      {selectedDate && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
            {new Date(calYear, calMonth, selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
          </span>
          {selectedSessions.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
              No completed workouts.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedSessions.map(s => (
                <div key={s.workout_session_id} style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-bright)',
                  padding: '8px 12px',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)' }}>
                    {s.workout_name}
                  </span>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {s.start_date_time && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                        {new Date(s.start_date_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        {s.end_date_time && ` — ${new Date(s.end_date_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                      </span>
                    )}
                    {s.difficulty_rating != null && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                        DIFF {s.difficulty_rating}/10
                      </span>
                    )}
                    {s.enjoyment_rating != null && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                        ENJOY {s.enjoyment_rating}/10
                      </span>
                    )}
                  </div>
                  {s.notes && (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {s.notes}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
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

  // ── Workout history / streaks ──
  const [workoutHistory, setWorkoutHistory] = useState([])
  const [currentStreak, setCurrentStreak] = useState(0)
  const [longestStreak, setLongestStreak] = useState(0)
  const [perWorkoutStreaks, setPerWorkoutStreaks] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  // ── Exercise progression ──
  const [exerciseProgression, setExerciseProgression] = useState([])
  const [exerciseProgLoading, setExerciseProgLoading] = useState(true)
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [exerciseProgRange, setExerciseProgRange] = useState('3M')
  const [showExFilterPanel, setShowExFilterPanel] = useState(false)

  // ── Hero numbers ──
  const [heroStats, setHeroStats] = useState(null)
  const [heroLoading, setHeroLoading] = useState(true)

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
    setHistoryLoading(true)
    fetch(`/api/stats/${user.user_id}/workout-history`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'ok') {
          setWorkoutHistory(data.sessions)
          setCurrentStreak(data.current_streak ?? 0)
          setLongestStreak(data.longest_streak ?? 0)
          setPerWorkoutStreaks(data.per_workout_streaks)
        }
      })
      .finally(() => setHistoryLoading(false))

    setExerciseProgLoading(true)
    fetch(`/api/stats/${user.user_id}/exercise-progression`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'ok') {
          setExerciseProgression(data.exercises)
          if (data.exercises.length > 0) setSelectedExercise(data.exercises[0].exercise_id)
        }
      })
      .finally(() => setExerciseProgLoading(false))

    setHeroLoading(true)
    fetch(`/api/stats/${user.user_id}/hero-stats`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'ok') setHeroStats(data.stats)
      })
      .finally(() => setHeroLoading(false))
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

      {/* ── Streaks + Calendar row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>

        {/* Streak counters */}
        <div className="dashboard-card">
          <span className="panel-title">WORKOUT STREAKS</span>

          {historyLoading ? (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', paddingTop: 8 }}>Loading…</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                <div className="stat-item">
                  <span className="stat-label">CURRENT STREAK</span>
                  <span className="stat-value" style={{ color: currentStreak > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {currentStreak}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>days</span>
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">LONGEST STREAK</span>
                  <span className="stat-value">
                    {longestStreak}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>days</span>
                  </span>
                </div>
              </div>

              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em', display: 'block', marginBottom: 10 }}>
                WEEKLY STREAKS BY WORKOUT
              </span>
              {perWorkoutStreaks.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                  Complete a workout this week or last to start a streak.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {perWorkoutStreaks.map(pw => (
                    <li key={pw.workout_id} style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      padding: '8px 12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}>{pw.workout_name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                          {pw.weekly_streak} wk{pw.weekly_streak !== 1 ? 's' : ''}
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 11,
                          color: pw.weekly_streak >= 4 ? 'var(--accent)' : pw.weekly_streak >= 2 ? 'var(--success)' : 'var(--text-muted)',
                        }}>
                          {'▮'.repeat(Math.min(pw.weekly_streak, 8))}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Workout calendar */}
        <div className="dashboard-card">
          <span className="panel-title">WORKOUT CALENDAR</span>
          {historyLoading ? (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', paddingTop: 8 }}>Loading…</p>
          ) : (
            <WorkoutCalendar sessions={workoutHistory} />
          )}
        </div>

      </div>

      {/* ── Hero Numbers + Exercise Progression (2-col) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>

      {/* ── Hero Numbers ── */}
      <div className="dashboard-card">
        <span className="panel-title">LIFETIME BESTS</span>
        {heroLoading ? (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', paddingTop: 8 }}>Loading…</p>
        ) : !heroStats ? (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', paddingTop: 8 }}>
            Complete some workouts to see your bests.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginTop: 4 }}>
            <div className="stat-item">
              <span className="stat-label">TOTAL WORKOUTS</span>
              <span className="stat-value">{heroStats.total_sessions}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">TOTAL VOLUME (kg)</span>
              <span className="stat-value" style={{ fontSize: heroStats.total_volume_kg >= 100000 ? 20 : 28 }}>
                {heroStats.total_volume_kg >= 1000
                  ? `${(heroStats.total_volume_kg / 1000).toFixed(1)}k`
                  : heroStats.total_volume_kg}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">MAX SESSION VOL (kg)</span>
              <span className="stat-value" style={{ fontSize: 24 }}>{heroStats.max_session_volume_kg}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">HEAVIEST SET (kg)</span>
              <span className="stat-value">{heroStats.heaviest_set_kg}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">BEST 1-SET REPS</span>
              <span className="stat-value">{heroStats.max_reps_in_set}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">AVG SESSION (min)</span>
              <span className="stat-value">{heroStats.avg_session_minutes}</span>
            </div>
            {heroStats.top_exercise_by_volume && (
              <div className="stat-item" style={{ gridColumn: 'span 2' }}>
                <span className="stat-label">MOST VOLUME — EXERCISE</span>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  color: 'var(--accent)',
                  lineHeight: 1.2,
                  marginTop: 2,
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}>
                  {heroStats.top_exercise_by_volume}
                </span>
              </div>
            )}
            {heroStats.top_pr && (
              <div className="stat-item" style={{ gridColumn: 'span 2' }}>
                <span className="stat-label">HEAVIEST PR</span>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  color: 'var(--text)',
                  lineHeight: 1.2,
                  marginTop: 2,
                  display: 'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}>
                  {heroStats.top_pr.exercise_name}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--accent)', marginLeft: 10 }}>
                    {heroStats.top_pr.weight_kg} kg × {heroStats.top_pr.reps}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Per-exercise PR list */}
        {heroStats?.exercise_prs?.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em', display: 'block', marginBottom: 10 }}>
              PERSONAL RECORDS BY EXERCISE
            </span>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 8,
            }}>
              {heroStats.exercise_prs.map(pr => (
                <div key={pr.exercise_id} style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {pr.exercise_name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--accent)' }}>
                      {pr.max_weight_kg}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>kg</span>
                    {pr.reps_at_max && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>× {pr.reps_at_max}</span>
                    )}
                  </div>
                  {pr.pr_date && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                      {new Date(pr.pr_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Exercise Weight Progression ── */}
      <div className="dashboard-card">
        {(() => {
          const progDays = RANGES.find(r => r.label === exerciseProgRange)?.days ?? 90
          const cutoff = progDays === Infinity ? 0 : Date.now() - progDays * 86400 * 1000

          const showExFilter = exerciseProgression.length > 3
          const activeExIds = selectedExercise instanceof Set
            ? selectedExercise
            : new Set(exerciseProgression.slice(0, 3).map(e => e.exercise_id))

          function toggleExercise(id) {
            setSelectedExercise(prev => {
              const base = prev instanceof Set
                ? prev
                : new Set(exerciseProgression.slice(0, 3).map(e => e.exercise_id))
              const next = new Set(base)
              next.has(id) ? next.delete(id) : next.add(id)
              // ensure the currently-viewed tab stays valid
              return next
            })
          }

          // tabs = exercises that pass the filter AND have data in range
          const tabExercises = exerciseProgression.filter(ex =>
            activeExIds.has(ex.exercise_id)
          )

          // resolve active tab: prefer current selectedExercise if it's an id (not a Set)
          const activeTabId = (selectedExercise instanceof Set || selectedExercise === null)
            ? tabExercises[0]?.exercise_id ?? null
            : selectedExercise

          const activeEx = exerciseProgression.find(e => e.exercise_id === activeTabId) ?? null

          const chartData = activeEx
            ? activeEx.history
                .filter(h => new Date(h.date).getTime() >= cutoff)
                .map(h => ({ ts: new Date(h.date).getTime(), value: Number(h.max_weight_kg) }))
                .sort((a, b) => a.ts - b.ts)
            : []

          return (
            <>
              <div className="flex-header" style={{ marginBottom: 0 }}>
                <span className="panel-title">EXERCISE PROGRESSION</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {showExFilter && (
                    <button
                      onClick={() => setShowExFilterPanel(v => !v)}
                      className={showExFilterPanel ? 'btn btn--accent' : 'btn btn--outline'}
                      style={{ fontSize: 10, padding: '3px 12px', letterSpacing: '0.06em', marginRight: 8, borderStyle: showExFilterPanel ? undefined : 'dashed' }}
                    >
                      ⊞ {activeExIds.size}/{exerciseProgression.length}
                    </button>
                  )}
                  {RANGES.map(r => (
                    <button
                      key={r.label}
                      onClick={() => setExerciseProgRange(r.label)}
                      className={exerciseProgRange === r.label ? 'btn btn--accent' : 'btn btn--outline'}
                      style={{ fontSize: 10, padding: '3px 10px', letterSpacing: '0.05em' }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {showExFilter && showExFilterPanel && (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 6,
                  padding: '12px 0 14px',
                  borderBottom: '1px solid var(--border)',
                  marginTop: 12,
                }}>
                  {exerciseProgression.map(ex => {
                    const on = activeExIds.has(ex.exercise_id)
                    return (
                      <button
                        key={ex.exercise_id}
                        onClick={() => toggleExercise(ex.exercise_id)}
                        style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 10px',
                          letterSpacing: '0.05em', textTransform: 'uppercase',
                          background: on ? 'var(--accent-glow)' : 'var(--bg)',
                          border: `1px solid ${on ? 'var(--accent)' : 'var(--border-bright)'}`,
                          color: on ? 'var(--accent)' : 'var(--text-muted)',
                          cursor: 'pointer', borderRadius: 2,
                        }}
                      >
                        {ex.exercise_name}
                      </button>
                    )
                  })}
                </div>
              )}

              {exerciseProgLoading ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>Loading…</p>
              ) : exerciseProgression.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>
                  No exercise logs yet — complete a workout with weights to see progression.
                </p>
              ) : tabExercises.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>
                  No exercises selected — use the filter to pick what to display.
                </p>
              ) : (
                <>
                  {/* Exercise tabs */}
                  <div style={{
                    display: 'flex', gap: 6, flexWrap: 'wrap',
                    marginTop: 14, marginBottom: 16,
                    paddingBottom: 14,
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {tabExercises.map(ex => (
                      <button
                        key={ex.exercise_id}
                        onClick={() => setSelectedExercise(ex.exercise_id)}
                        style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 12px',
                          letterSpacing: '0.05em', textTransform: 'uppercase',
                          background: activeTabId === ex.exercise_id ? 'var(--accent-glow)' : 'var(--bg)',
                          border: `1px solid ${activeTabId === ex.exercise_id ? 'var(--accent)' : 'var(--border-bright)'}`,
                          color: activeTabId === ex.exercise_id ? 'var(--accent)' : 'var(--text-muted)',
                          cursor: 'pointer', borderRadius: 2,
                        }}
                      >
                        {ex.exercise_name}
                      </button>
                    ))}
                  </div>

                  {/* Chart for active tab */}
                  {activeEx && (() => {
                    const maxWeight = Math.max(...activeEx.history.map(h => Number(h.max_weight_kg)))
                    return (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 14 }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            {activeEx.exercise_name}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                            PR <span style={{ color: 'var(--text)', marginLeft: 4 }}>{maxWeight} kg</span>
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                            {activeEx.history.length} session{activeEx.history.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {chartData.length < 2 ? (
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                            Not enough data in this range — try a wider window.
                          </p>
                        ) : (
                          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '14px 16px' }}>
                            <ExerciseSparkline data={chartData} label="MAX WEIGHT (kg)" />
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </>
              )}
            </>
          )
        })()}
      </div>

      </div>{/* end 2-col grid */}

      {/* ── Body Measurement Progression ── */}
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
