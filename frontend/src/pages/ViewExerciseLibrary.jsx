import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function ViewExerciseLibrary() {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')
  const [muscleFilter, setMuscleFilter] = useState('ALL')

  useEffect(() => {
    fetch('/api/exercises/library', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'ok') setExercises(data.exercises || [])
        else setError(data.message || 'Failed to load exercises.')
      })
      .catch(() => setError('Network error.'))
      .finally(() => setLoading(false))
  }, [])

  // Collect all unique primary muscle group names for the filter pills
  const muscleOptions = useMemo(() => {
    const names = new Set()
    exercises.forEach(ex =>
      ex.muscle_groups
        .filter(m => m.role === 'Primary')
        .forEach(m => names.add(m.name))
    )
    return ['ALL', ...Array.from(names).sort()]
  }, [exercises])

  const filtered = useMemo(() => {
    return exercises.filter(ex => {
      const matchSearch = ex.name.toLowerCase().includes(search.toLowerCase()) ||
        (ex.description || '').toLowerCase().includes(search.toLowerCase())
      const matchMuscle = muscleFilter === 'ALL' ||
        ex.muscle_groups.some(m => m.role === 'Primary' && m.name === muscleFilter)
      return matchSearch && matchMuscle
    })
  }, [exercises, search, muscleFilter])

  return (
    <Layout title="EXERCISE LIBRARY">

      {/* Search + filter bar */}
      <div className="dashboard-card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input
          type="text"
          placeholder="Search by name or description..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--bg)',
            border: '1px solid var(--border-bright)',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            padding: '8px 12px',
            outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-bright)'}
        />

        {/* Muscle filter pills */}
        {!loading && muscleOptions.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {muscleOptions.map(opt => (
              <button
                key={opt}
                onClick={() => setMuscleFilter(opt)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  padding: '3px 10px',
                  border: '1px solid',
                  borderRadius: 2,
                  cursor: 'pointer',
                  background: muscleFilter === opt ? 'var(--accent)' : 'transparent',
                  borderColor: muscleFilter === opt ? 'var(--accent)' : 'var(--border-bright)',
                  color: muscleFilter === opt ? '#000' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading / error */}
      {loading && (
        <div className="dashboard-card">
          <p className="data-monospace text-muted" style={{ fontSize: 12 }}>LOADING...</p>
        </div>
      )}
      {error && (
        <div className="dashboard-card">
          <p className="data-monospace" style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</p>
        </div>
      )}

      {/* Results */}
      {!loading && !error && (
        <>
          <p className="data-monospace text-muted" style={{ fontSize: 11, marginBottom: 12 }}>
            {filtered.length} EXERCISE{filtered.length !== 1 ? 'S' : ''}
            {search && ` MATCHING "${search.toUpperCase()}"`}
            {muscleFilter !== 'ALL' && ` · ${muscleFilter.toUpperCase()}`}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filtered.map(ex => {
              const primary   = ex.muscle_groups.filter(m => m.role === 'Primary')
              const secondary = ex.muscle_groups.filter(m => m.role === 'Secondary')

              return (
                <div key={ex.exercise_id} className="exercise-row" style={{ alignItems: 'flex-start', padding: '14px 16px', gap: 14 }}>

                  {/* Left: name + description */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-h)', lineHeight: 1 }}>
                      {ex.name}
                      {!!ex.is_unilateral && (
                        <span className="tag border-slate" style={{ marginLeft: 10, fontSize: 9, verticalAlign: 'middle' }}>UNILATERAL</span>
                      )}
                    </span>
                    {ex.description && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                        {stripHtml(ex.description).slice(0, 120)}{stripHtml(ex.description).length > 120 ? '…' : ''}
                      </p>
                    )}
                    {/* Muscle tags */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                      {primary.map(m => (
                        <span key={m.name} className="tag border-amber">{m.name}</span>
                      ))}
                      {secondary.map(m => (
                        <span key={m.name} className="tag border-slate">{m.name}</span>
                      ))}
                    </div>
                  </div>

                  {/* Right: equipment + view button */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {ex.equipment.map(eq => (
                        <span key={eq} className="tag border-slate" style={{ fontSize: 9 }}>{eq}</span>
                      ))}
                    </div>
                    <Link
                      to={`/exercise/${ex.exercise_id}`}
                      className="btn btn--outline btn--sm"
                      style={{ marginLeft: 0, flexShrink: 0 }}
                    >
                      VIEW
                    </Link>
                  </div>

                </div>
              )
            })}

            {filtered.length === 0 && !loading && (
              <div className="dashboard-card" style={{ textAlign: 'center', padding: '32px 0' }}>
                <p className="data-monospace text-muted" style={{ fontSize: 12 }}>
                  NO EXERCISES MATCH YOUR FILTERS.
                </p>
              </div>
            )}
          </div>
        </>
      )}

    </Layout>
  )
}
