import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'

const SET_TYPES = ['Working', 'Warm-up', 'Drop']

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function emptySetForm() {
  return { type: 'Working', weight: '', reps: '', rpe: '', rest_time: '' }
}

// ── Set row (display mode) ────────────────────────────────────────────────────
function SetRowDisplay({ s, onEdit, onDelete, readOnly }) {
  return (
    <div className="set-row">
      <span className="set-row__num">{String(s.number).padStart(2, '0')}</span>
      <div className="set-row__field">
        <label>TYPE</label>
        <span className="set-row__value">{s.type || '—'}</span>
      </div>
      <div className="set-row__field">
        <label>WEIGHT</label>
        <span className="set-row__value">{s.weight != null ? `${s.weight} kg` : '—'}</span>
      </div>
      <div className="set-row__field">
        <label>REPS</label>
        <span className="set-row__value">{s.reps ?? '—'}</span>
      </div>
      <div className="set-row__field">
        <label>RPE</label>
        <span className="set-row__value">{s.rpe ?? '—'}</span>
      </div>
      <div className="set-row__field">
        <label>REST</label>
        <span className="set-row__value">{s.rest_time || '—'}</span>
      </div>
      {!readOnly && (
        <div className="set-row__actions">
          <button className="btn btn--ghost btn--sm" style={{ margin: 0 }} onClick={onEdit}>EDIT</button>
          <button
            className="btn btn--ghost btn--sm"
            style={{ margin: 0, color: 'var(--danger)' }}
            onClick={onDelete}
          >✕</button>
        </div>
      )}
    </div>
  )
}

// ── Set row (edit mode) ───────────────────────────────────────────────────────
function SetRowEdit({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    type:      initial.type      || 'Working',
    weight:    initial.weight    ?? '',
    reps:      initial.reps      ?? '',
    rpe:       initial.rpe       ?? '',
    rest_time: initial.rest_time || '',
  })
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="set-row" style={{ flexWrap: 'wrap', gap: 8, paddingTop: 10, paddingBottom: 10 }}>
      <span className="set-row__num">{String(initial.number).padStart(2, '0')}</span>
      <div className="set-row__field">
        <label>TYPE</label>
        <select value={form.type} onChange={set('type')}>
          {SET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="set-row__field">
        <label>WEIGHT KG</label>
        <input type="number" min="0" step="0.5" placeholder="—" value={form.weight} onChange={set('weight')} />
      </div>
      <div className="set-row__field">
        <label>REPS</label>
        <input type="number" min="1" placeholder="—" value={form.reps} onChange={set('reps')} />
      </div>
      <div className="set-row__field">
        <label>RPE</label>
        <input type="number" min="0" max="10" step="0.5" placeholder="—" value={form.rpe} onChange={set('rpe')} />
      </div>
      <div className="set-row__field" style={{ minWidth: 90 }}>
        <label>REST (HH:MM:SS)</label>
        <input type="text" placeholder="00:01:30" value={form.rest_time} onChange={set('rest_time')} />
      </div>
      <div className="set-row__actions">
        <button className="btn btn--accent btn--sm" style={{ margin: 0 }} onClick={() => onSave(form)}>SAVE</button>
        <button className="btn btn--ghost btn--sm" style={{ margin: 0 }} onClick={onCancel}>CANCEL</button>
      </div>
    </div>
  )
}

// ── Add set form ──────────────────────────────────────────────────────────────
function AddSetForm({ onSave, onCancel }) {
  const [form, setForm] = useState(emptySetForm())
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      padding: '10px 12px',
      marginTop: 8,
    }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="set-row__field">
          <label>TYPE</label>
          <select value={form.type} onChange={set('type')}>
            {SET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="set-row__field">
          <label>WEIGHT KG</label>
          <input type="number" min="0" step="0.5" placeholder="—" value={form.weight} onChange={set('weight')} />
        </div>
        <div className="set-row__field">
          <label>REPS</label>
          <input type="number" min="1" placeholder="—" value={form.reps} onChange={set('reps')} />
        </div>
        <div className="set-row__field">
          <label>RPE</label>
          <input type="number" min="0" max="10" step="0.5" placeholder="—" value={form.rpe} onChange={set('rpe')} />
        </div>
        <div className="set-row__field" style={{ minWidth: 90 }}>
          <label>REST (HH:MM:SS)</label>
          <input type="text" placeholder="00:01:30" value={form.rest_time} onChange={set('rest_time')} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="btn btn--accent btn--sm" style={{ margin: 0 }} onClick={() => onSave(form)}>ADD SET</button>
          <button className="btn btn--ghost btn--sm" style={{ margin: 0 }} onClick={onCancel}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LiveSession() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [data, setData]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingSetId, setEditingSetId] = useState(null)
  const [addingSetFor, setAddingSetFor] = useState(null) // record_log_id

  // Finalization panel state
  const [notes, setNotes]           = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [enjoyment, setEnjoyment]   = useState('')
  const [energy, setEnergy]         = useState('')
  const [finishing, setFinishing]   = useState(false)
  const [finishError, setFinishError] = useState(null)
  const [sessionError, setSessionError] = useState(null)

  const loadSession = useCallback(() => {
    return fetch(`/api/sessions/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.status === 'ok') {
          setData(d)
          setError(null)
        } else {
          setError(d.message || 'Session not found.')
        }
      })
      .catch(() => setError('Network error.'))
  }, [id])

  useEffect(() => {
    setLoading(true)
    loadSession().finally(() => setLoading(false))
  }, [loadSession])

  // ── Record operations ───────────────────────────────────────────────────
  async function handleAddRecord(exerciseId) {
    setPickerOpen(false)
    setSessionError(null)
    try {
      const res = await fetch(`/api/sessions/${id}/records`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise_id: exerciseId }),
      })
      const data = await res.json()
      if (data.status !== 'ok') {
        setSessionError(data.message || 'Failed to add record.')
        return
      }
    } catch {
      setSessionError('Network error.')
      return
    }
    await loadSession()
  }

  async function handleDeleteRecord(recordLogId) {
    if (!window.confirm('Delete this record and all its sets?')) return
    setSessionError(null)
    try {
      const res = await fetch(`/api/records/${recordLogId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.status !== 'ok') {
        setSessionError(data.message || 'Failed to delete record.')
        return
      }
    } catch {
      setSessionError('Network error.')
      return
    }
    await loadSession()
  }

  // ── Set operations ──────────────────────────────────────────────────────
  async function handleAddSet(recordLogId, form) {
    setAddingSetFor(null)
    setSessionError(null)
    try {
      const res = await fetch(`/api/records/${recordLogId}/sets`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:      form.type      || null,
          weight:    form.weight    !== '' ? Number(form.weight)    : null,
          reps:      form.reps      !== '' ? Number(form.reps)      : null,
          rpe:       form.rpe       !== '' ? Number(form.rpe)       : null,
          rest_time: form.rest_time !== '' ? form.rest_time         : null,
        }),
      })
      const data = await res.json()
      if (data.status !== 'ok') {
        setSessionError(data.message || 'Failed to add set.')
        return
      }
    } catch {
      setSessionError('Network error.')
      return
    }
    await loadSession()
  }

  async function handleEditSet(setLogId, form) {
    setEditingSetId(null)
    setSessionError(null)
    try {
      const res = await fetch(`/api/sets/${setLogId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:      form.type      || null,
          weight:    form.weight    !== '' ? Number(form.weight)    : null,
          reps:      form.reps      !== '' ? Number(form.reps)      : null,
          rpe:       form.rpe       !== '' ? Number(form.rpe)       : null,
          rest_time: form.rest_time !== '' ? form.rest_time         : null,
        }),
      })
      const data = await res.json()
      if (data.status !== 'ok') {
        setSessionError(data.message || 'Failed to update set.')
        return
      }
    } catch {
      setSessionError('Network error.')
      return
    }
    await loadSession()
  }

  async function handleDeleteSet(setLogId) {
    setSessionError(null)
    try {
      const res = await fetch(`/api/sets/${setLogId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.status !== 'ok') {
        setSessionError(data.message || 'Failed to delete set.')
        return
      }
    } catch {
      setSessionError('Network error.')
      return
    }
    await loadSession()
  }

  // ── Finish / abandon ────────────────────────────────────────────────────
  async function handleFinish() {
    setFinishing(true)
    setFinishError(null)
    try {
      const res = await fetch(`/api/sessions/${id}/finish`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes:               notes || null,
          difficulty_rating:   difficulty   !== '' ? Number(difficulty)   : null,
          enjoyment_rating:    enjoyment    !== '' ? Number(enjoyment)    : null,
          energy_level_rating: energy       !== '' ? Number(energy)       : null,
        }),
      })
      const d = await res.json()
      if (d.status === 'ok') {
        navigate(`/workout/${d.workout_id}`)
      } else {
        setFinishError(d.message || 'Failed to finish session.')
      }
    } catch {
      setFinishError('Network error.')
    } finally {
      setFinishing(false)
    }
  }

  async function handleAbandon() {
    if (!window.confirm('Abandon this session? All logged data will be kept.')) return
    setSessionError(null)
    try {
      const res = await fetch(`/api/sessions/${id}/abandon`, {
        method: 'POST',
        credentials: 'include',
      })
      const d = await res.json()
      if (d.status === 'ok') {
        navigate(`/workout/${d.workout_id}`)
      } else {
        setSessionError(d.message || 'Failed to abandon session.')
      }
    } catch {
      setSessionError('Network error.')
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout title="LIVE SESSION">
        <div className="dashboard-card">
          <p className="data-monospace text-muted">LOADING...</p>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout title="LIVE SESSION">
        <div className="dashboard-card">
          <p className="data-monospace" style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</p>
        </div>
      </Layout>
    )
  }

  const { session: sess, planned_exercises, records } = data
  const sortedRecords = [...records].sort((a, b) => a.number - b.number)
  const isInProgress = sess.completion_status === 'In Progress'
  const isAbandoned  = !isInProgress && sess.notes === 'Abandoned'

  return (
    <Layout title={`SESSION — ${sess.workout_name.toUpperCase()}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Header ── */}
        <div className="dashboard-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <h2 style={{ fontSize: 28, margin: 0 }}>{sess.workout_name}</h2>
                {isInProgress && <span className="pill pill--warning">IN PROGRESS</span>}
                {!isInProgress && !isAbandoned && <span className="pill pill--success">COMPLETED</span>}
                {isAbandoned && <span className="pill pill--danger">ABANDONED</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="data-monospace text-muted" style={{ fontSize: 12 }}>
                  STARTED {fmtDate(sess.start_date_time)} AT {fmtTime(sess.start_date_time)}
                </span>
                {!isInProgress && sess.end_date_time && (
                  <span className="data-monospace text-muted" style={{ fontSize: 12 }}>
                    ENDED {fmtDate(sess.end_date_time)} AT {fmtTime(sess.end_date_time)}
                  </span>
                )}
              </div>
            </div>
            {isInProgress && (
              <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                <button
                  className="btn btn--danger btn--sm"
                  style={{ margin: 0 }}
                  onClick={handleAbandon}
                >
                  ABANDON
                </button>
              </div>
            )}
          </div>
        </div>

        {sessionError && (
          <p className="data-monospace" style={{ color: 'var(--danger)', fontSize: 12, marginTop: -8 }}>
            {sessionError}
          </p>
        )}

        {/* ── Record cards ── */}
        {sortedRecords.map(rec => {
          const sortedSets = [...rec.sets].sort((a, b) => a.number - b.number)
          return (
            <div key={rec.record_log_id} className="record-card">
              <div className="record-card__header">
                <span className="record-card__title">
                  REC {String(rec.number).padStart(2, '0')} — {rec.exercise_name.toUpperCase()}
                </span>
                <span className="data-monospace text-muted" style={{ fontSize: 11 }}>
                  {rec.set_count} {rec.set_count === 1 ? 'SET' : 'SETS'}
                </span>
                {isInProgress && (
                  <button
                    className="btn btn--ghost btn--sm"
                    style={{ margin: 0, color: 'var(--danger)' }}
                    onClick={() => handleDeleteRecord(rec.record_log_id)}
                  >
                    ✕ DELETE
                  </button>
                )}
              </div>

              <div className="record-card__body">
                {sortedSets.length === 0 && (
                  <p className="data-monospace text-muted" style={{ fontSize: 11 }}>No sets logged yet.</p>
                )}
                {sortedSets.map(s => (
                  isInProgress && editingSetId === s.set_log_id
                    ? <SetRowEdit
                        key={s.set_log_id}
                        initial={s}
                        onSave={(form) => handleEditSet(s.set_log_id, form)}
                        onCancel={() => setEditingSetId(null)}
                      />
                    : <SetRowDisplay
                        key={s.set_log_id}
                        s={s}
                        readOnly={!isInProgress}
                        onEdit={() => setEditingSetId(s.set_log_id)}
                        onDelete={() => handleDeleteSet(s.set_log_id)}
                      />
                ))}

                {isInProgress && (
                  addingSetFor === rec.record_log_id
                    ? <AddSetForm
                        onSave={(form) => handleAddSet(rec.record_log_id, form)}
                        onCancel={() => setAddingSetFor(null)}
                      />
                    : (
                      <button
                        className="btn btn--outline btn--sm"
                        style={{ margin: 0, marginTop: 8, alignSelf: 'flex-start' }}
                        onClick={() => { setAddingSetFor(rec.record_log_id); setEditingSetId(null) }}
                      >
                        + ADD SET
                      </button>
                    )
                )}
              </div>
            </div>
          )
        })}

        {/* ── Add record button ── */}
        {isInProgress && (
          <button
            className="btn btn--outline btn--full"
            style={{ margin: 0 }}
            onClick={() => { setPickerOpen(p => !p); setAddingSetFor(null); setEditingSetId(null) }}
          >
            {pickerOpen ? '— CLOSE EXERCISE PICKER' : '+ ADD RECORD'}
          </button>
        )}

        {/* ── Exercise picker ── */}
        {isInProgress && pickerOpen && (
          <div className="dashboard-card">
            <div className="panel-title">SELECT EXERCISE</div>
            {planned_exercises.length === 0 ? (
              <p className="data-monospace text-muted" style={{ fontSize: 12 }}>No planned exercises in this workout template.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[...planned_exercises]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map(pe => (
                    <div key={pe.sort_order} className="exercise-row">
                      <span className="exercise-row__num">{String(pe.sort_order).padStart(2, '0')}</span>
                      <span className="exercise-row__name" style={{ fontSize: 16 }}>{pe.exercise_name}</span>
                      <div className="exercise-row__actions">
                        <button
                          className="btn btn--accent btn--sm"
                          style={{ margin: 0 }}
                          onClick={() => handleAddRecord(pe.exercise_id)}
                        >
                          + ADD
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── End session panel / Summary ── */}
        {isInProgress ? (
          <div className="dashboard-card">
            <div className="panel-title">END SESSION</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label>
                <span className="field-label">SESSION NOTES</span>
                <textarea
                  className="field-textarea"
                  placeholder="How did it go?"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </label>

              <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <label>
                  <span className="field-label">DIFFICULTY (0–10)</span>
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    max="10"
                    step="1"
                    placeholder="—"
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </label>
                <label>
                  <span className="field-label">ENJOYMENT (0–10)</span>
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    max="10"
                    step="1"
                    placeholder="—"
                    value={enjoyment}
                    onChange={e => setEnjoyment(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </label>
                <label>
                  <span className="field-label">ENERGY (0–10)</span>
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    max="10"
                    step="1"
                    placeholder="—"
                    value={energy}
                    onChange={e => setEnergy(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </label>
              </div>

              {finishError && (
                <p className="data-monospace" style={{ color: 'var(--danger)', fontSize: 12 }}>{finishError}</p>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn btn--accent"
                  style={{ flex: 1, margin: 0, fontSize: 15, padding: '12px 24px', fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}
                  onClick={handleFinish}
                  disabled={finishing}
                >
                  {finishing ? 'FINISHING...' : 'FINISH SESSION ✓'}
                </button>
                <button
                  className="btn btn--ghost"
                  style={{ margin: 0, color: 'var(--danger)', fontSize: 13 }}
                  onClick={handleAbandon}
                >
                  ABANDON
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="dashboard-card">
            <div className="panel-title">SESSION SUMMARY</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <span className="field-label">SESSION NOTES</span>
                <p className="data-monospace" style={{ fontSize: 13, marginTop: 4, color: isAbandoned ? 'var(--text-muted)' : 'inherit' }}>
                  {isAbandoned ? 'Session was abandoned.' : (sess.notes || 'No notes.')}
                </p>
              </div>

              <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div>
                  <span className="field-label">DIFFICULTY</span>
                  <p className="data-monospace" style={{ fontSize: 20, marginTop: 4 }}>
                    {sess.difficulty_rating ?? '—'}
                  </p>
                </div>
                <div>
                  <span className="field-label">ENJOYMENT</span>
                  <p className="data-monospace" style={{ fontSize: 20, marginTop: 4 }}>
                    {sess.enjoyment_rating ?? '—'}
                  </p>
                </div>
                <div>
                  <span className="field-label">ENERGY</span>
                  <p className="data-monospace" style={{ fontSize: 20, marginTop: 4 }}>
                    {sess.energy_level_rating ?? '—'}
                  </p>
                </div>
              </div>

              <button
                className="btn btn--outline"
                style={{ margin: 0, alignSelf: 'flex-start' }}
                onClick={() => navigate(`/workout/${sess.workout_id}`)}
              >
                ← BACK TO WORKOUT
              </button>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
