import { useState, useEffect } from 'react'
import Layout from '../components/Layout'

function fmtVolume(kg) {
  if (!kg || kg === 0) return '0 kg'
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k kg`
  return `${kg} kg`
}

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  useEffect(() => {
    fetch('/api/leaderboard', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'ok') setLeaderboard(data.leaderboard || [])
        else setError(data.message || 'Failed to load leaderboard.')
      })
      .catch(() => setError('Network error.'))
      .finally(() => setLoading(false))
  }, [])

  const me  = leaderboard.find(u => u.is_me)
  const top = leaderboard[0]

  return (
    <Layout title="LEADERBOARD">

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

      {!loading && !error && (
        <>
          {/* Your stats strip */}
          {me && (
            <div className="stats-grid" style={{ marginBottom: 24 }}>
              <div className="stat-item">
                <span className="stat-label">YOUR RANK</span>
                <span className="stat-value text-accent">#{String(me.rank).padStart(2, '0')}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">TOTAL VOLUME</span>
                <span className="stat-value">{fmtVolume(me.total_volume)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">MAX LIFT</span>
                <span className="stat-value text-success">{me.max_weight} <span className="data-monospace" style={{ fontSize: 14 }}>kg</span></span>
              </div>
              <div className="stat-item">
                <span className="stat-label">SESSIONS DONE</span>
                <span className="stat-value">{me.sessions_done}</span>
              </div>
            </div>
          )}

          {/* Rank table */}
          <div className="dashboard-card" style={{ padding: 0 }}>

            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '48px 1fr 160px 120px 100px',
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
            }}>
              {['RANK', 'USERNAME', 'VOLUME', 'MAX LIFT', 'SESSIONS'].map(h => (
                <span key={h} className="stat-label">{h}</span>
              ))}
            </div>

            {/* Rows */}
            {leaderboard.map(u => {
              const barPct = top?.total_volume > 0
                ? Math.round((u.total_volume / top.total_volume) * 100)
                : 0

              return (
                <div
                  key={u.user_id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '48px 1fr 160px 120px 100px',
                    alignItems: 'center',
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border)',
                    borderLeft: u.is_me ? '3px solid var(--accent)' : '3px solid transparent',
                    background: u.is_me ? 'var(--accent-glow)' : 'transparent',
                  }}
                >
                  {/* Rank */}
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    color: u.rank === 1 ? 'var(--accent)' : 'var(--text-muted)',
                  }}>
                    {String(u.rank).padStart(2, '0')}
                  </span>

                  {/* Username + volume progress bar */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 18,
                      color: u.is_me ? 'var(--accent)' : 'var(--text-h)',
                    }}>
                      {u.is_me ? `► ${u.username} ◄` : u.username}
                    </span>
                    <div style={{ height: 3, background: 'var(--border)', width: '80%', maxWidth: 200 }}>
                      <div style={{
                        height: '100%',
                        width: `${barPct}%`,
                        background: u.is_me ? 'var(--accent)' : 'var(--border-bright)',
                      }} />
                    </div>
                  </div>

                  {/* Total volume */}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)' }}>
                    {fmtVolume(u.total_volume)}
                  </span>

                  {/* Max weight */}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
                    {u.max_weight} kg
                  </span>

                  {/* Sessions done */}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
                    {u.sessions_done}
                  </span>
                </div>
              )
            })}

            {leaderboard.length === 0 && (
              <p className="data-monospace text-muted" style={{ fontSize: 12, padding: 20 }}>
                NO DATA — COMPLETE A WORKOUT TO APPEAR ON THE BOARD.
              </p>
            )}
          </div>
        </>
      )}

    </Layout>
  )
}
