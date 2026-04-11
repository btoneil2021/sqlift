import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'

// Mock data (measurements, goals, achievements — not yet wired to backend)
const mockMeasurements = [
  { date_time: '2026-04-01', weight: 83.4, waist_measurement: 82, chest_measurement: 102, bicep_measurement: 38 },
  { date_time: '2026-03-15', weight: 84.1, waist_measurement: 83, chest_measurement: 101, bicep_measurement: 37.5 },
]

const mockGoals = [
  { goal_id: 1, description: 'Bench press 100 kg for 5 reps', target_date: '2026-06-30', completion_status: 'in_progress' },
  { goal_id: 2, description: 'Run 5k under 25 minutes', target_date: '2026-05-15', completion_status: 'in_progress' },
  { goal_id: 3, description: 'Lose 5 kg of body fat', target_date: '2026-03-01', completion_status: 'completed' },
]

const mockAchievements = [
  { achievement_id: 1, name: 'First Workout', description: 'Logged your first session', date_earned: '2026-01-10' },
  { achievement_id: 2, name: '30-Day Streak', description: 'Worked out 30 days in a row', date_earned: '2026-02-09' },
  { achievement_id: 3, name: 'Century Club', description: 'Logged 100 total sets', date_earned: '2026-03-20' },
]

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

  const [friends, setFriends] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [addUsername, setAddUsername] = useState('')
  const [addError, setAddError] = useState(null)
  const [addLoading, setAddLoading] = useState(false)
  const [actingId, setActingId] = useState(null) // tracks remove/accept in-flight

  useEffect(() => {
    if (!user) return
    setFriendsLoading(true)
    fetch(`/api/profile/${user.user_id}/friends`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data.status === 'ok') setFriends(data.friends) })
      .finally(() => setFriendsLoading(false))
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

  const latest = mockMeasurements[0]
  const prev = mockMeasurements[1]
  const weightDelta = (latest.weight - prev.weight).toFixed(1)
  const deltaSign = weightDelta > 0 ? '+' : ''

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

  const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()

  return (
    <Layout title="USER PROFILE">

      {/* ── Identity + Biometrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        {/* Identity card */}
        <div className="dashboard-card">
          <div className="flex-header">
            <span className="panel-title">IDENTITY</span>
            {/* Only the authenticated user sees edit controls */}
            {!editing
              ? <button className="btn btn--outline" style={{ fontSize: 11, padding: '4px 12px' }} onClick={startEdit}>EDIT</button>
              : <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--accent" style={{ fontSize: 11, padding: '4px 12px' }} onClick={saveEdit} disabled={saving}>
                    {saving ? 'SAVING…' : 'SAVE'}
                  </button>
                  <button className="btn btn--outline" style={{ fontSize: 11, padding: '4px 12px' }} onClick={cancelEdit} disabled={saving}>CANCEL</button>
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
          <div className="panel-title">LATEST MEASUREMENTS — {latest.date_time}</div>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">WEIGHT (kg)</span>
              <span className="stat-value">{latest.weight}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 2, color: weightDelta > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {deltaSign}{weightDelta} vs prev
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">WAIST (cm)</span>
              <span className="stat-value">{latest.waist_measurement}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">CHEST (cm)</span>
              <span className="stat-value">{latest.chest_measurement}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">BICEP (cm)</span>
              <span className="stat-value">{latest.bicep_measurement}</span>
            </div>
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 'auto', paddingTop: 16 }}>
            Log new measurements from the Stats page.
          </p>
        </div>
      </div>

      {/* ── Goals + Friends ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>

        <div className="dashboard-card">
          <div className="panel-title">GOALS</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mockGoals.map(goal => (
              <li key={goal.goal_id} style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 14, lineHeight: 1.3 }}>{goal.description}</span>
                  {goal.completion_status === 'completed'
                    ? <span className="tag border-success">DONE</span>
                    : <span className="tag border-amber">ACTIVE</span>}
                </div>
                {goal.target_date && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>TARGET {goal.target_date}</span>
                )}
              </li>
            ))}
          </ul>
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
        <div className="panel-title">ACHIEVEMENTS — {mockAchievements.length}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {mockAchievements.map(a => (
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
