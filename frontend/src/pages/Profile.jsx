import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'



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

function FriendAvatar({ first_name, last_name }) {
  const initials = `${first_name[0]}${last_name[0]}`.toUpperCase()
  return (
    <div style={{
      width: 40, height: 40, flexShrink: 0,
      background: 'var(--surface-2)',
      border: '1px solid var(--border-bright)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)',
    }}>
      {initials}
    </div>
  )
}

const SEX_OPTIONS = ['M', 'F', 'Other', '']

function FieldRow({ label, value, editing, editValue, onChange, type = 'text', suffix }) {
  return (
    <div className="stat-item" style={{ gridColumn: 'span 1' }}>
      <span className="stat-label">{label}</span>
      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <input
            className="profile-edit-input"
            type={type}
            value={editValue ?? ''}
            onChange={e => onChange(e.target.value)}
            step={type === 'number' ? 'any' : undefined}
          />
          {suffix && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{suffix}</span>}
        </div>
      ) : (
        <span className="stat-value" style={{ fontSize: 22 }}>{value || <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 14 }}>—</span>}</span>
      )}
    </div>
  )
}

function SelectRow({ label, value, editing, editValue, onChange, options }) {
  return (
    <div className="stat-item" style={{ gridColumn: 'span 1' }}>
      <span className="stat-label">{label}</span>
      {editing ? (
        <select
          className="profile-edit-input"
          value={editValue ?? ''}
          onChange={e => onChange(e.target.value)}
          style={{ marginTop: 4 }}
        >
          {options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
        </select>
      ) : (
        <span className="stat-value" style={{ fontSize: 22 }}>{value || <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 14 }}>—</span>}</span>
      )}
    </div>
  )
}

export default function Profile() {
  const { user, updateUser } = useAuth()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [pwOpen, setPwOpen] = useState(false)
  const [pwDraft, setPwDraft] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  const [measurements, setMeasurements] = useState([])

  const [goals, setGoals] = useState([])

  const [achievements, setAchievements] = useState([])

  const [friends, setFriends] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [addUsername, setAddUsername] = useState('')
  const [addError, setAddError] = useState(null)
  const [addLoading, setAddLoading] = useState(false)
  const [actingId, setActingId] = useState(null) // tracks remove/accept in-flight

  useEffect(() => {
    if (!user) return
    fetch(`/api/profile/${user.user_id}/measurements`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data.status === 'ok') setMeasurements(data.measurements) })
    fetch(`/api/stats/${user.user_id}/goals`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data.status === 'ok') setGoals(data.goals) })
    setFriendsLoading(true)
    fetch(`/api/profile/${user.user_id}/friends`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data.status === 'ok') setFriends(data.friends) })
      .finally(() => setFriendsLoading(false))
    fetch(`/api/profile/${user.user_id}/achievements?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data.status === 'ok') setAchievements(data.achievements) })
  }, [user])

  async function handleAddFriend(e) {
    e.preventDefault()
    const trimmed = addUsername.trim()
    if (!trimmed) return
    if (trimmed === user.username) {
      setAddError('You cannot add yourself.')
      return
    }
    setAddLoading(true)
    setAddError(null)
    try {
      const res = await fetch(`/api/profile/${user.user_id}/friends`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setFriends(prev => {
          const without = prev.filter(f => f.friend_user_id !== data.friend.friend_user_id)
          return [...without, data.friend]
        })
        setAddUsername('')
      } else {
        setAddError(data.message || 'Failed to send request.')
      }
    } catch {
      setAddError('Network error.')
    } finally {
      setAddLoading(false)
    }
  }

  async function handleAccept(username, friendId) {
    setActingId(friendId)
    try {
      const res = await fetch(`/api/profile/${user.user_id}/friends`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setFriends(prev => prev.map(f =>
          f.friend_user_id === friendId ? data.friend : f
        ))
      }
    } finally {
      setActingId(null)
    }
  }

  async function handleRemoveFriend(friendId) {
    setActingId(friendId)
    try {
      const res = await fetch(`/api/profile/${user.user_id}/friends/${friendId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setFriends(prev => prev.filter(f => f.friend_user_id !== friendId))
      }
    } finally {
      setActingId(null)
    }
  }

  if (!user) {
    return (
      <Layout title="USER PROFILE">
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Not authenticated.</p>
      </Layout>
    )
  }

  const latest = measurements[0] ?? null
  const prev = measurements[1] ?? null

  function pctDelta(field) {
    if (!latest || !prev) return null
    const a = parseFloat(latest[field])
    const b = parseFloat(prev[field])
    if (!b || isNaN(a) || isNaN(b)) return null
    return ((a - b) / b * 100).toFixed(1)
  }

  function DeltaBadge({ field }) {
    const d = pctDelta(field)
    if (d === null) return null
    const up = parseFloat(d) > 0
    return (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, marginTop: 2, color: up ? 'var(--danger)' : 'var(--success)' }}>
        {up ? '+' : ''}{d}% vs {prev.date_time ? new Date(prev.date_time).toLocaleDateString('en-US', { month: 'short', d: 'numeric' }) : 'prev'}
      </span>
    )
  }

  function startEdit() {
    setDraft({
      first_name: user.first_name,
      last_name:  user.last_name,
      height:     user.height ?? '',
      sex:        user.sex ?? '',
      email:      user.email,
      phone_num:  user.phone_num,
    })
    setError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft({})
    setError(null)
  }

  async function saveEdit() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/profile/${user.user_id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: draft.first_name,
          last_name:  draft.last_name,
          height:     draft.height !== '' ? Number(draft.height) : null,
          sex:        draft.sex || null,
          email:      draft.email,
          phone_num:  draft.phone_num,
        }),
      })
      const data = await res.json()
      if (data.status === 'ok') {
        updateUser(data.user)
        setEditing(false)
        setDraft({})
      } else {
        setError(data.message || 'Save failed.')
      }
    } catch {
      setError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  const set = (field) => (val) => setDraft(d => ({ ...d, [field]: val }))

  async function savePassword() {
    setPwError(null)
    setPwSuccess(false)
    if (!pwDraft.current || !pwDraft.next) {
      setPwError('All fields are required.')
      return
    }
    if (pwDraft.next !== pwDraft.confirm) {
      setPwError('New passwords do not match.')
      return
    }
    if (pwDraft.next.length < 6) {
      setPwError('New password must be at least 6 characters.')
      return
    }
    setPwSaving(true)
    try {
      const res = await fetch(`/api/profile/${user.user_id}/password`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: pwDraft.current, new_password: pwDraft.next }),
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setPwSuccess(true)
        setPwDraft({ current: '', next: '', confirm: '' })
        setPwOpen(false)
      } else {
        setPwError(data.message || 'Failed to change password.')
      }
    } catch {
      setPwError('Network error.')
    } finally {
      setPwSaving(false)
    }
  }

  const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()

  return (
    <Layout title="USER PROFILE">

      {/* ── Identity + Biometrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* Identity card */}
        <div className="dashboard-card">
          <div className="flex-header">
            <span className="panel-title">IDENTITY</span>
            {!editing
              ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {pwSuccess && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--success)' }}>PASSWORD UPDATED</span>}
                  <button className="btn btn--ghost btn--sm" onClick={() => { setPwOpen(true); setPwSuccess(false) }}>PASSWORD</button>
                  <button className="btn btn--outline btn--sm" onClick={startEdit}>EDIT</button>
                </div>
              : <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--accent btn--sm" onClick={saveEdit} disabled={saving}>
                    {saving ? 'SAVING…' : 'SAVE'}
                  </button>
                  <button className="btn btn--outline btn--sm" onClick={cancelEdit} disabled={saving}>CANCEL</button>
                </div>
            }
          </div>

          {error && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{error}</p>
          )}

          {/* Avatar + name */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
            <div style={{
              width: 64, height: 64, flexShrink: 0,
              background: 'var(--surface-2)', border: '2px solid var(--border-bright)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text-muted)',
            }}>
              {editing
                ? `${(draft.first_name?.[0] || '?')}${(draft.last_name?.[0] || '?')}`.toUpperCase()
                : initials}
            </div>
            <div style={{ flex: 1 }}>
              {editing ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <input className="profile-edit-input" placeholder="First name" value={draft.first_name} onChange={e => set('first_name')(e.target.value)} style={{ flex: 1, minWidth: 80 }} />
                  <input className="profile-edit-input" placeholder="Last name" value={draft.last_name} onChange={e => set('last_name')(e.target.value)} style={{ flex: 1, minWidth: 80 }} />
                </div>
              ) : (
                <h2 style={{ fontSize: 26, marginBottom: 4 }}>{user.first_name} {user.last_name}</h2>
              )}
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent)' }}>@{user.username}</p>
            </div>
          </div>

          {/* Editable fields grid */}
          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <FieldRow label="HEIGHT (cm)" value={user.height} editing={editing} editValue={draft.height} onChange={set('height')} type="number" />
            <SelectRow label="SEX" value={user.sex} editing={editing} editValue={draft.sex} onChange={set('sex')} options={SEX_OPTIONS} />
            <FieldRow label="EMAIL" value={user.email} editing={editing} editValue={draft.email} onChange={set('email')} type="email" />
            <FieldRow label="PHONE" value={user.phone_num} editing={editing} editValue={draft.phone_num} onChange={set('phone_num')} type="tel" />
          </div>
        </div>

        {/* Latest Measurements (read-only, from measurement_log) */}
        <div className="dashboard-card">
          <div className="flex-header">
            <span className="panel-title">
              LATEST MEASUREMENTS{latest ? ` — ${new Date(latest.date_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
            </span>
            <a href="/stats" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none' }}>
              LOG →
            </a>
          </div>
          {latest ? (
            <div className="stats-grid">
              {[
                { field: 'weight',            label: 'WEIGHT (kg)' },
                { field: 'waist_measurement', label: 'WAIST (cm)' },
                { field: 'chest_measurement', label: 'CHEST (cm)' },
                { field: 'bicep_measurement', label: 'BICEP (cm)' },
              ].map(({ field, label }) => (
                <div key={field} className="stat-item">
                  <span className="stat-label">{label}</span>
                  <span className="stat-value">{latest[field] ?? '—'}</span>
                  <DeltaBadge field={field} />
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>No measurements logged yet.</p>
          )}
        </div>
      </div>

      {/* ── Change Password Modal ── */}
      {pwOpen && (
        <div className="overlay" onClick={() => { setPwOpen(false); setPwError(null); setPwDraft({ current: '', next: '', confirm: '' }) }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, width: '100%' }}>
            <button className="modal-close" onClick={() => { setPwOpen(false); setPwError(null); setPwDraft({ current: '', next: '', confirm: '' }) }}>✕</button>

            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 4 }}>CHANGE PASSWORD</h2>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 24 }}>@{user.username}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <span className="stat-label" style={{ display: 'block', marginBottom: 6 }}>CURRENT PASSWORD</span>
                <input
                  className="profile-edit-input"
                  type="password"
                  placeholder="Enter current password"
                  value={pwDraft.current}
                  onChange={e => setPwDraft(d => ({ ...d, current: e.target.value }))}
                  autoComplete="current-password"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <span className="stat-label" style={{ display: 'block', marginBottom: 6 }}>NEW PASSWORD</span>
                <input
                  className="profile-edit-input"
                  type="password"
                  placeholder="At least 6 characters"
                  value={pwDraft.next}
                  onChange={e => setPwDraft(d => ({ ...d, next: e.target.value }))}
                  autoComplete="new-password"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <span className="stat-label" style={{ display: 'block', marginBottom: 6 }}>CONFIRM NEW PASSWORD</span>
                <input
                  className="profile-edit-input"
                  type="password"
                  placeholder="Repeat new password"
                  value={pwDraft.confirm}
                  onChange={e => setPwDraft(d => ({ ...d, confirm: e.target.value }))}
                  autoComplete="new-password"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {pwError && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--danger)', margin: 0 }}>{pwError}</p>
              )}

              <button
                className="btn btn--accent"
                style={{ width: '100%', padding: '10px', fontSize: 13, marginTop: 4 }}
                onClick={savePassword}
                disabled={pwSaving}
              >
                {pwSaving ? 'SAVING…' : 'UPDATE PASSWORD'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Goals + Friends ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        <div className="dashboard-card">
          <div className="flex-header">
            <span className="panel-title">GOALS — {goals.length}</span>
            <a href="/stats" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none' }}>
              {goals.length > 3 ? `+${goals.length - 3} MORE →` : 'MANAGE →'}
            </a>
          </div>
          {goals.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>No goals set yet. Add them from the Stats page.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {goals.slice(0, 3).map(goal => (
                <li key={goal.goal_id} style={{
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
                  opacity: goal.completion_status === 'completed' ? 0.6 : 1,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{
                      fontSize: 14, lineHeight: 1.3,
                      textDecoration: goal.completion_status === 'completed' ? 'line-through' : 'none',
                      color: goal.completion_status === 'completed' ? 'var(--text-muted)' : 'var(--text)',
                    }}>{goal.description}</span>
                    {goal.completion_status === 'completed'
                      ? <span className="tag border-success">DONE</span>
                      : <span className="tag border-amber">ACTIVE</span>}
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

        <div className="dashboard-card" style={{ minHeight: 0 }}>
          <div className="flex-header">
            <span className="panel-title">FRIENDS — {friends.length}</span>
          </div>

          {/* Add friend form */}
          <form onSubmit={handleAddFriend} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              className="profile-edit-input"
              placeholder="Add by username…"
              value={addUsername}
              onChange={e => { setAddUsername(e.target.value); setAddError(null) }}
              disabled={addLoading}
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              className="btn btn--accent"
              style={{ fontSize: 11, padding: '4px 12px', flexShrink: 0 }}
              disabled={addLoading || !addUsername.trim()}
            >
              {addLoading ? '…' : 'ADD'}
            </button>
          </form>
          {addError && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--danger)', marginBottom: 8 }}>{addError}</p>
          )}

          {/* Scrollable list */}
          <ul style={{
            listStyle: 'none', padding: 0, margin: 0,
            display: 'flex', flexDirection: 'column', gap: 8,
            maxHeight: 260, overflowY: 'auto',
            paddingRight: 4,
          }}>
            {friendsLoading && (
              <li style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>Loading…</li>
            )}
            {!friendsLoading && friends.length === 0 && (
              <li style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>No friends yet.</li>
            )}
            {friends.map(f => (
              <li key={f.friend_user_id} style={{
                background: 'var(--bg)',
                border: `1px solid ${f.status === 'received' ? 'var(--accent)' : 'var(--border)'}`,
                padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <FriendAvatar first_name={f.first_name} last_name={f.last_name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 15, display: 'block' }}>{f.first_name} {f.last_name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>@{f.username}</span>
                </div>

                {f.status === 'friends' && (
                  <span title="Friends" style={{ fontSize: 13, color: 'var(--success)', flexShrink: 0 }}>✓</span>
                )}
                {f.status === 'sent' && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>PENDING</span>
                )}
                {f.status === 'received' && (
                  <button
                    className="btn btn--accent"
                    style={{ fontSize: 10, padding: '3px 8px', flexShrink: 0 }}
                    onClick={() => handleAccept(f.username, f.friend_user_id)}
                    disabled={actingId === f.friend_user_id}
                  >
                    {actingId === f.friend_user_id ? '…' : 'ACCEPT'}
                  </button>
                )}

                <button
                  className="btn btn--ghost"
                  style={{ fontSize: 11, color: 'var(--danger)', padding: '2px 6px', flexShrink: 0 }}
                  onClick={() => handleRemoveFriend(f.friend_user_id)}
                  disabled={actingId === f.friend_user_id}
                  title={f.status === 'received' ? 'Decline' : 'Remove'}
                >
                  {actingId === f.friend_user_id ? '…' : '✕'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Achievements ── */}
      <div className="dashboard-card full-width">
        <div className="panel-title">ACHIEVEMENTS — {achievements.length}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {achievements.length === 0 && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)', gridColumn: '1/-1' }}>
              No achievements yet. Complete a workout to get started.
            </span>
          )}
          {achievements.map(a => (
            <div key={a.achievement_id} style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              padding: 16, display: 'flex', flexDirection: 'column', gap: 6,
              borderLeft: '3px solid var(--accent)',
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-h)' }}>{a.name}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>{a.description}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>EARNED {a.date_earned}</span>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
