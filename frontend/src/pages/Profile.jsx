import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'

function Avatar({ user }) {
  const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
  if (user.profile_pic_url) {
    return <img src={user.profile_pic_url} alt="avatar" className="profile-avatar profile-avatar--img" />
  }
  return (
    <div className="profile-avatar profile-avatar--initials">
      <span>{initials}</span>
    </div>
  )
}

export default function Profile() {
  const { user: authUser, updateUser } = useAuth()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [pwOpen, setPwOpen] = useState(false)
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  useEffect(() => {
    if (!authUser) return
    fetch(`/api/profile/${authUser.user_id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'ok') {
          setUser(data.user)
        } else {
          setError(data.message || 'Failed to load profile.')
        }
      })
      .catch(() => setError('Could not reach the server.'))
      .finally(() => setLoading(false))
  }, [authUser])

  function startEdit() {
    setDraft({ ...user })
    setEditing(true)
    setPwOpen(false)
    setPwError('')
    setSaveError(null)
    setPw({ current: '', next: '', confirm: '' })
  }

  function cancelEdit() {
    setEditing(false)
    setPwOpen(false)
    setPwError('')
    setSaveError(null)
  }

  async function saveEdit() {
    if (!draft.username || !draft.first_name || !draft.last_name || !draft.email || !draft.phone_num) return
    if (pwOpen) {
      if (!pw.current) { setPwError('Enter your current password.'); return }
      if (pw.next.length < 6) { setPwError('New password must be at least 6 characters.'); return }
      if (pw.next !== pw.confirm) { setPwError('Passwords do not match.'); return }
    }

    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/profile/${authUser.user_id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await res.json()
      if (data.status !== 'ok') {
        setSaveError(data.message || 'Failed to save changes.')
        setSaving(false)
        return
      }
      setUser(data.user)
      updateUser(data.user)

      if (pwOpen) {
        const pwRes = await fetch(`/api/profile/${authUser.user_id}/password`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_password: pw.current, new_password: pw.next }),
        })
        const pwData = await pwRes.json()
        if (pwData.status !== 'ok') {
          setSaveError(pwData.message || 'Profile saved but password update failed.')
          setSaving(false)
          return
        }
      }

      setEditing(false)
      setPwOpen(false)
      setPwError('')
      setPw({ current: '', next: '', confirm: '' })
    } catch {
      setSaveError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  async function submitPasswordChange() {
    if (!pw.current) { setPwError('Enter your current password.'); return }
    if (pw.next.length < 6) { setPwError('New password must be at least 6 characters.'); return }
    if (pw.next !== pw.confirm) { setPwError('Passwords do not match.'); return }

    setPwSaving(true)
    setPwError('')
    try {
      const res = await fetch(`/api/profile/${authUser.user_id}/password`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: pw.current, new_password: pw.next }),
      })
      const data = await res.json()
      if (data.status !== 'ok') {
        setPwError(data.message || 'Failed to update password.')
      } else {
        setPwOpen(false)
        setPw({ current: '', next: '', confirm: '' })
      }
    } catch {
      setPwError('Could not reach the server.')
    } finally {
      setPwSaving(false)
    }
  }

  function handleDraft(field, value) {
    setDraft(d => ({ ...d, [field]: value }))
  }

  const canSave = draft.username && draft.first_name && draft.last_name && draft.email && draft.phone_num

  if (loading) {
    return (
      <Layout title="USER PROFILE">
        <p className="data-monospace text-muted">Loading...</p>
      </Layout>
    )
  }

  if (error || !user) {
    return (
      <Layout title="USER PROFILE">
        <p className="data-monospace" style={{ color: 'var(--danger)' }}>{error || 'User not found.'}</p>
      </Layout>
    )
  }

  return (
    <Layout title="USER PROFILE">
      <div className="profile-layout">

        {/* ── Identity strip ── */}
        <div className="profile-identity dashboard-card">
          <Avatar user={editing ? draft : user} />
          <div className="profile-identity-info">
            {editing ? (
              <input
                className="profile-username-input"
                value={draft.username}
                onChange={e => handleDraft('username', e.target.value)}
                placeholder="username"
              />
            ) : (
              <h2 className="profile-username">@{user.username}</h2>
            )}
            <p className="profile-fullname">
              {editing
                ? <span className="profile-name-row">
                    <input className="profile-name-input" value={draft.first_name} onChange={e => handleDraft('first_name', e.target.value)} placeholder="First name" />
                    <input className="profile-name-input" value={draft.last_name} onChange={e => handleDraft('last_name', e.target.value)} placeholder="Last name" />
                  </span>
                : `${user.first_name} ${user.last_name}`
              }
            </p>
            {editing ? (
              <select
                className="profile-sex-select"
                value={draft.sex}
                onChange={e => handleDraft('sex', e.target.value)}
              >
                <option value="">Select sex</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            ) : (
              user.sex && <span className="profile-sex-tag">{user.sex}</span>
            )}
          </div>
          <div className="profile-identity-actions">
            {editing ? (
              <>
                <button
                  className="btn btn--primary btn--sm"
                  onClick={saveEdit}
                  disabled={!canSave || saving}
                >
                  {saving ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={cancelEdit} disabled={saving}>CANCEL</button>
                {saveError && <p className="profile-pw-error">{saveError}</p>}
              </>
            ) : (
              <button className="btn btn--primary btn--sm" onClick={startEdit}>EDIT PROFILE</button>
            )}
          </div>
        </div>

        {/* ── Info grid ── */}
        <div className="dashboard-card">
          <div className="panel-title">ACCOUNT DETAILS</div>
          <div className="profile-fields-grid">
            <FieldBlock
              label="EMAIL"
              value={user.email}
              editValue={draft.email}
              editing={editing}
              onChange={v => handleDraft('email', v)}
              type="email"
              required
            />
            <FieldBlock
              label="PHONE"
              value={user.phone_num}
              editValue={draft.phone_num}
              editing={editing}
              onChange={v => handleDraft('phone_num', v)}
              type="tel"
              required
            />
            <FieldBlock
              label="HEIGHT"
              value={<><span className="data-monospace">{user.height}</span> <span className="stat-unit">cm</span></>}
              editValue={draft.height}
              editing={editing}
              onChange={v => handleDraft('height', v)}
              type="number"
              suffix="cm"
            />
          </div>
        </div>

        {/* ── Security ── */}
        <div className="dashboard-card">
          <div className="panel-title">SECURITY</div>
          {!pwOpen ? (
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => { setPwOpen(true); setPwError('') }}
            >
              CHANGE PASSWORD
            </button>
          ) : (
            <div className="profile-pw-form">
              <label className="profile-field-label">
                CURRENT PASSWORD
                <input
                  type="password"
                  className="profile-input"
                  value={pw.current}
                  onChange={e => setPw(p => ({ ...p, current: e.target.value }))}
                  placeholder="••••••••"
                />
              </label>
              <label className="profile-field-label">
                NEW PASSWORD
                <input
                  type="password"
                  className="profile-input"
                  value={pw.next}
                  onChange={e => setPw(p => ({ ...p, next: e.target.value }))}
                  placeholder="Min. 6 characters"
                />
              </label>
              <label className="profile-field-label">
                CONFIRM NEW PASSWORD
                <input
                  type="password"
                  className="profile-input"
                  value={pw.confirm}
                  onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                  placeholder="••••••••"
                />
              </label>
              {pwError && <p className="profile-pw-error">{pwError}</p>}
              <div className="profile-pw-actions">
                {editing ? (
                  <span className="profile-pw-note data-monospace">Password will save with profile.</span>
                ) : (
                  <>
                    <button
                      className="btn btn--primary btn--sm"
                      onClick={submitPasswordChange}
                      disabled={pwSaving}
                    >
                      {pwSaving ? 'UPDATING...' : 'UPDATE PASSWORD'}
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => { setPwOpen(false); setPwError('') }} disabled={pwSaving}>CANCEL</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}

function FieldBlock({ label, value, editValue, editing, onChange, type = 'text', suffix, required }) {
  return (
    <div className="stat-item profile-field-block">
      <span className="stat-label">{label}</span>
      {editing ? (
        <div className="profile-input-wrap">
          <input
            className="profile-input profile-input--stat"
            type={type}
            value={editValue}
            onChange={e => onChange(e.target.value)}
            required={required}
          />
          {suffix && <span className="profile-input-suffix data-monospace">{suffix}</span>}
        </div>
      ) : (
        <span className="stat-value profile-stat-value">{value}</span>
      )}
    </div>
  )
}
