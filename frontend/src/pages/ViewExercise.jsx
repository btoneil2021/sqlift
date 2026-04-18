import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../components/Layout'

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}


export default function ViewExercise() {
  const { id } = useParams()
  const [exercise, setExercise] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/exercises/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'ok') setExercise(data.exercise)
        else setError(data.message || 'Exercise not found.')
      })
      .catch(() => setError('Network error.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <Layout title="EXERCISE">
        <div className="dashboard-card">
          <p className="data-monospace text-muted" style={{ fontSize: 12 }}>LOADING...</p>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout title="EXERCISE">
        <div className="dashboard-card">
          <p className="data-monospace" style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>{error}</p>
          <Link to="/home" className="btn btn--outline btn--sm">← Back to Home</Link>
        </div>
      </Layout>
    )
  }

  const primary    = exercise.muscle_groups.filter(m => m.role === 'Primary')
  const secondary  = exercise.muscle_groups.filter(m => m.role === 'Secondary')
  const stabilizer = exercise.muscle_groups.filter(m => m.role === 'Stabilizer')
  const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'webp', 'gif']
  const VIDEO_TYPES = ['mp4', 'webm', 'mov', 'avi']
  const images = (exercise.media || []).filter(m => IMAGE_TYPES.includes(m.type?.toLowerCase()))
  const videos = (exercise.media || []).filter(m => VIDEO_TYPES.includes(m.type?.toLowerCase()))

  return (
    <Layout title={exercise.name.toUpperCase()}>

      {/* Description + Muscles + Equipment — single card */}
      <div className="dashboard-card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Description */}
        {exercise.description && (
          <div>
            <div className="panel-title">DESCRIPTION</div>
            {!!exercise.is_unilateral && (
              <span className="tag border-slate" style={{ display: 'inline-block', marginBottom: 10 }}>UNILATERAL</span>
            )}
            <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>
              {stripHtml(exercise.description)}
            </p>
          </div>
        )}

        {/* Muscle groups */}
        <div>
          <div className="panel-title">MUSCLES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {primary.length > 0 && (
              <div>
                <span className="stat-label" style={{ display: 'block', marginBottom: 6 }}>PRIMARY</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {primary.map(m => <span key={m.name} className="tag border-amber">{m.name}</span>)}
                </div>
              </div>
            )}
            {secondary.length > 0 && (
              <div>
                <span className="stat-label" style={{ display: 'block', marginBottom: 6 }}>SECONDARY</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {secondary.map(m => <span key={m.name} className="tag border-slate">{m.name}</span>)}
                </div>
              </div>
            )}
            {stabilizer.length > 0 && (
              <div>
                <span className="stat-label" style={{ display: 'block', marginBottom: 6 }}>STABILIZER</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {stabilizer.map(m => <span key={m.name} className="tag border-success">{m.name}</span>)}
                </div>
              </div>
            )}
            {exercise.muscle_groups.length === 0 && (
              <p className="data-monospace text-muted" style={{ fontSize: 12 }}>No muscle groups recorded.</p>
            )}
          </div>
        </div>

        {/* Equipment */}
        {exercise.equipment.length > 0 && (
          <div>
            <div className="panel-title">EQUIPMENT</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {exercise.equipment.map(eq => (
                <span key={eq} className="tag border-slate">{eq}</span>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Media */}
      {(images.length > 0 || videos.length > 0) && (
        <div className="dashboard-card" style={{ marginBottom: 20 }}>
          <div className="panel-title">MEDIA</div>

          {images.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: videos.length > 0 ? 16 : 0 }}>
              {images.map(m => (
                <img
                  key={m.url}
                  src={m.url}
                  alt={exercise.name}
                  style={{
                    width: '100%',
                    aspectRatio: '4/3',
                    objectFit: 'cover',
                    border: '1px solid var(--border)',
                    display: 'block',
                  }}
                  onError={e => { e.target.style.display = 'none' }}
                />
              ))}
            </div>
          )}

          {videos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {videos.map(m => (
                <video
                  key={m.url}
                  src={m.url}
                  controls
                  style={{
                    width: '100%',
                    maxWidth: 560,
                    border: '1px solid var(--border)',
                    display: 'block',
                    background: '#000',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {exercise.instruction && (
        <div className="dashboard-card">
          <div className="panel-title">HOW TO PERFORM</div>
          <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>
            {stripHtml(exercise.instruction)}
          </p>
        </div>
      )}

    </Layout>
  )
}
