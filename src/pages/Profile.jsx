import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { IconUserCircle, IconPencil, IconCheck, IconX, IconLogout, IconBell, IconChevronRight } from "@tabler/icons-react";
import './Profile.css';

function formatMemberSince(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export default function Profile({ session }) {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const metaName = session.user.user_metadata?.display_name
    setDisplayName(metaName || session.user.email.split('@')[0])
  }, [session])

  function startEditName() {
    setNameInput(displayName)
    setNameError(null)
    setEditingName(true)
  }

  async function handleSaveName(e) {
    e.preventDefault()
    if (!nameInput.trim()) return
    setSavingName(true)
    setNameError(null)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: nameInput.trim() },
      })
      if (error) throw error
      setDisplayName(nameInput.trim())
      setEditingName(false)
    } catch (err) {
      setNameError('Could not save your name. Please try again.')
    } finally {
      setSavingName(false)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <div className="page">
      <header className="app-header">
        <div>
          <p className="header-greeting">Account</p>
          <h2>Profile</h2>
        </div>
      </header>

      <main className="content">
        <div className="profile-avatar-section">
          <div className="profile-avatar">
            <IconUserCircle size={56} />
          </div>
          {editingName ? (
            <form className="profile-name-form" onSubmit={handleSaveName}>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your name"
                autoFocus
              />
              <button type="submit" className="profile-name-btn profile-name-btn-confirm" disabled={savingName}>
                <IconCheck size={18} />
              </button>
              <button type="button" className="profile-name-btn" onClick={() => setEditingName(false)} disabled={savingName}>
                <IconX size={18} />
              </button>
            </form>
          ) : (
            <div className="profile-name-row">
              <h3>{displayName}</h3>
              <button className="profile-name-edit" onClick={startEditName}>
                <IconPencil size={16} />
              </button>
            </div>
          )}
          {nameError && <p className="profile-error">{nameError}</p>}
          <p className="profile-email">{session.user.email}</p>
          <p className="profile-since">🌱 Blooming since {formatMemberSince(session.user.created_at)}</p>
        </div>

        <div className="profile-section">
          <p className="profile-section-title">Notifications</p>
          <button className="profile-card profile-link-row" onClick={() => navigate('/reminders')}>
            <div className="profile-row-label">
              <IconBell size={20} />
              <span>Reminders</span>
            </div>
            <IconChevronRight size={18} />
          </button>
        </div>

        <div className="profile-section">
          <button className="profile-signout-btn" onClick={handleSignOut} disabled={signingOut}>
            <IconLogout size={18} />
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </main>
      <BottomNav active="profile" />
    </div>
  )
}