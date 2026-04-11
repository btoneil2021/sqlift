import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function emptyDraft() {
  return { name: '', preferred_day: '', selectedTags: [], exercises: [] }
}

function makeExerciseEntry(ex, sortOrder) {
  return {
    _key: Date.now() + Math.random(),
    exercise_id: ex.exercise_id,
    exercise_name: ex.exercise_name,
    sort_order: sortOrder,
    target_sets: '',
    target_reps: '',
    target_weight: '',
    expected_rest_time: '',
  }
}

export default function NewWorkout() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit') // null = create mode

  const [refData, setRefData]           = useState({ tags: [], muscle_groups: [], equipment: [] })
  const [draft, setDraft]               = useState(emptyDraft())
  const [searchQ, setSearchQ]           = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching]       = useState(false)
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState(null)
  const debounceRef = useRef(null)

  // ── Load reference data + (if editing) existing workout ──────────────────
  useEffect(() => {
    setLoading(true)
    const fetches = [
      fetch('/api/workouts/new/reference-data', { credentials: 'include' }).then(r => r.json()),
    ]
    if (editId) {
      fetches.push(
        fetch(`/api/workouts/${editId}`, { credentials: 'include' }).then(r => r.json())
      )
    }

    Promise.all(fetches)
      .then(([refRes, workoutRes]) => {
        if (refRes.status === 'ok') setRefData(refRes.data)
        if (workoutRes && workoutRes.status === 'ok') {
          const w = workoutRes.workout
          setDraft({
            name: w.header.name || '',
            preferred_day: w.header.preferred_day || '',
            selectedTags: (w.tags || []).map(t => t.tag_name),
            exercises: (w.exercises || []).map(ex => ({
              _key: Date.now() + Math.random(),
              exercise_id: ex.exercise_id,
              exercise_name: ex.exercise_name,
              sort_order: ex.sort_order,
              target_sets: ex.target_sets ?? '',
              target_reps: ex.target_reps ?? '',
              target_weight: ex.target_weight ?? '',
              expected_rest_time: ex.expected_rest_time ?? '',
            })),
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [editId])

  // ── Exercise search (debounced) ───────────────────────────────────────────
  const runSearch = useCallback((q) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    setSearching(true)
    fetch(`/api/exercises/search?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data.status === 'ok') setSearchResults(data.results) })
      .catch(() => {})
      .finally(() => setSearching(false))
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(searchQ), 300)
    return () => clearTimeout(debounceRef.current)
  }, [searchQ, runSearch])

  // Seed results on load
  useEffect(() => { runSearch('') }, [runSearch])

  // ── Draft helpers ─────────────────────────────────────────────────────────
  function toggleTag(tagName) {
    setDraft(d => ({
      ...d,
      selectedTags: d.selectedTags.includes(tagName)
        ? d.selectedTags.filter(t => t !== tagName)
        : [...d.selectedTags, tagName],
    }))
  }

  function addExercise(ex) {
    setDraft(d => {
      const maxOrder = d.exercises.reduce((m, e) => Math.max(m, e.sort_order), 0)
      return { ...d, exercises: [...d.exercises, makeExerciseEntry(ex, maxOrder + 1)] }
    })
  }

  function removeExercise(key) {
    setDraft(d => {
      const filtered = d.exercises.filter(e => e._key !== key)
      // Reassign sort_order 1..n
      return { ...d, exercises: filtered.map((e, i) => ({ ...e, sort_order: i + 1 })) }
    })
  }

  function moveExercise(key, dir) {
    setDraft(d => {
      const arr = [...d.exercises].sort((a, b) => a.sort_order - b.sort_order)
      const idx = arr.findIndex(e => e._key === key)
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= arr.length) return d
      // Swap sort_order values
      const tmp = arr[idx].sort_order
      arr[idx] = { ...arr[idx], sort_order: arr[swapIdx].sort_order }
      arr[swapIdx] = { ...arr[swapIdx], sort_order: tmp }
      return { ...d, exercises: arr }
    })
  }

  function updateExerciseField(key, field, value) {
    setDraft(d => ({
      ...d,
      exercises: d.exercises.map(e => e._key === key ? { ...e, [field]: value } : e),
    }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!draft.name.trim()) {
      setError('Workout name is required.')
      return
    }
    if (draft.exercises.length === 0) {
      setError('Add at least one exercise.')
      return
    }

    setError(null)
    setSaving(true)

    const payload = {
      name: draft.name.trim(),
      preferred_day: draft.preferred_day || null,
      tags: draft.selectedTags.map(name => ({ name })),
      exercises: draft.exercises.map(e => ({
        exercise_id: e.exercise_id,
        sort_order: e.sort_order,
        target_sets:         e.target_sets      !== '' ? Number(e.target_sets)      : null,
        target_reps:         e.target_reps      !== '' ? Number(e.target_reps)      : null,
        target_weight:       e.target_weight    !== '' ? Number(e.target_weight)    : null,
        expected_rest_time:  e.expected_rest_time !== '' ? e.expected_rest_time     : null,
      })),
    }

    try {
      const url    = editId ? `/api/workouts/${editId}` : '/api/workouts'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.status === 'ok') {
        navigate(`/workout/${editId || data.workout_id}`)
      } else {
        setError(data.message || 'Save failed.')
      }
    } catch {
      setError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const title = editId ? 'EDIT WORKOUT' : 'CREATE WORKOUT'
  const sortedExercises = [...draft.exercises].sort((a, b) => a.sort_order - b.sort_order)

  if (loading) {
    return (
      <Layout title={title}>
        <div className="dashboard-card">
          <p className="data-monospace text-muted">LOADING...</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout title={title}>
      <div className="builder-layout">

        {/* ── LEFT PANE ── */}
        <div className="builder-pane">

          {/* Metadata */}
          <div className="dashboard-card">
            <div className="panel-title">WORKOUT METADATA</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                <span className="field-label">WORKOUT NAME</span>
                <input
                  className="field-input"
                  type="text"
                  placeholder="e.g. Push Day A"
                  value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                />
              </label>
              <label>
                <span className="field-label">PREFERRED DAY</span>
                <select
                  className="field-select"
                  value={draft.preferred_day}
                  onChange={e => setDraft(d => ({ ...d, preferred_day: e.target.value }))}
                >
                  <option value="">— none —</option>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
            </div>
          </div>

          {/* Tags */}
          {refData.tags.length > 0 && (
            <div className="dashboard-card">
              <div className="panel-title">TAGS</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {refData.tags.map(t => {
                  const active = draft.selectedTags.includes(t.name)
                  return (
                    <button
                      key={t.name}
                      className={`btn btn--sm ${active ? 'btn--accent' : 'btn--outline'}`}
                      style={{ margin: 0 }}
                      onClick={() => toggleTag(t.name)}
                    >
                      {t.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Exercise library search */}
          <div className="dashboard-card">
            <div className="panel-title">EXERCISE LIBRARY</div>
            <input
              className="field-input"
              type="text"
              placeholder="Search exercises..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{ marginBottom: 12 }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 360, overflowY: 'auto' }}>
              {searching && (
                <p className="data-monospace text-muted" style={{ fontSize: 11, padding: '8px 0' }}>Searching...</p>
              )}
              {!searching && searchResults.length === 0 && (
                <p className="data-monospace text-muted" style={{ fontSize: 11, padding: '8px 0' }}>No exercises found.</p>
              )}
              {searchResults.map(ex => (
                <div key={ex.exercise_id} className="exercise-row">
                  <span className="exercise-row__name" style={{ fontSize: 15 }}>{ex.exercise_name}</span>
                  <div className="exercise-row__actions">
                    <button
                      className="btn btn--outline btn--sm"
                      style={{ margin: 0 }}
                      onClick={() => addExercise(ex)}
                    >
                      + ADD
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANE ── */}
        <div className="builder-pane">

          <div className="dashboard-card" style={{ flex: 1 }}>
            <div className="flex-header">
              <span className="panel-title" style={{ margin: 0, padding: 0, border: 'none' }}>
                EXERCISE PLAN ({draft.exercises.length})
              </span>
            </div>

            {draft.exercises.length === 0 ? (
              <p className="data-monospace text-muted" style={{ fontSize: 12, padding: '24px 0', textAlign: 'center' }}>
                Add exercises from the library →
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                {sortedExercises.map((ex, idx) => (
                  <div key={ex._key} style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    padding: '10px 12px',
                  }}>
                    {/* Row header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span className="data-monospace text-muted" style={{ fontSize: 12, minWidth: 24 }}>
                        {String(ex.sort_order).padStart(2, '0')}
                      </span>
                      <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--text-h)' }}>
                        {ex.exercise_name}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn--ghost btn--sm"
                          style={{ margin: 0, padding: '2px 6px' }}
                          onClick={() => moveExercise(ex._key, 'up')}
                          disabled={idx === 0}
                          title="Move up"
                        >↑</button>
                        <button
                          className="btn btn--ghost btn--sm"
                          style={{ margin: 0, padding: '2px 6px' }}
                          onClick={() => moveExercise(ex._key, 'down')}
                          disabled={idx === sortedExercises.length - 1}
                          title="Move down"
                        >↓</button>
                        <button
                          className="btn btn--ghost btn--sm"
                          style={{ margin: 0, padding: '2px 6px', color: 'var(--danger)' }}
                          onClick={() => removeExercise(ex._key)}
                          title="Remove"
                        >✕</button>
                      </div>
                    </div>
                    {/* Target fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                      <label>
                        <span className="field-label" style={{ fontSize: 9 }}>SETS</span>
                        <input
                          className="field-input"
                          type="number"
                          min="1"
                          placeholder="—"
                          value={ex.target_sets}
                          onChange={e => updateExerciseField(ex._key, 'target_sets', e.target.value)}
                          style={{ padding: '5px 8px', fontSize: 13, fontFamily: 'var(--font-mono)' }}
                        />
                      </label>
                      <label>
                        <span className="field-label" style={{ fontSize: 9 }}>REPS</span>
                        <input
                          className="field-input"
                          type="number"
                          min="1"
                          placeholder="—"
                          value={ex.target_reps}
                          onChange={e => updateExerciseField(ex._key, 'target_reps', e.target.value)}
                          style={{ padding: '5px 8px', fontSize: 13, fontFamily: 'var(--font-mono)' }}
                        />
                      </label>
                      <label>
                        <span className="field-label" style={{ fontSize: 9 }}>WEIGHT KG</span>
                        <input
                          className="field-input"
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="—"
                          value={ex.target_weight}
                          onChange={e => updateExerciseField(ex._key, 'target_weight', e.target.value)}
                          style={{ padding: '5px 8px', fontSize: 13, fontFamily: 'var(--font-mono)' }}
                        />
                      </label>
                      <label>
                        <span className="field-label" style={{ fontSize: 9 }}>REST (HH:MM:SS)</span>
                        <input
                          className="field-input"
                          type="text"
                          placeholder="00:01:30"
                          value={ex.expected_rest_time}
                          onChange={e => updateExerciseField(ex._key, 'expected_rest_time', e.target.value)}
                          style={{ padding: '5px 8px', fontSize: 13, fontFamily: 'var(--font-mono)' }}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="data-monospace" style={{ color: 'var(--danger)', fontSize: 12, margin: 0 }}>
              {error}
            </p>
          )}

          {/* Save button */}
          <button
            className="btn btn--accent btn--full"
            style={{ margin: 0, fontSize: 15, padding: '12px 24px', fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? (editId ? 'UPDATING...' : 'SAVING...')
              : (editId ? 'UPDATE WORKOUT' : 'SAVE WORKOUT')}
          </button>

        </div>
      </div>
    </Layout>
  )
}
