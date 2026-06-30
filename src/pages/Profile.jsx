import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconUserCircle, IconPencil, IconCheck, IconX, IconMoon, IconSun, IconLogout } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import './Profile.css'

export default function Profile({ session }) {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState(null)
  const [darkMode, setDarkMode] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const metaName = session.user.user_metadata?.display_name
    setDisplayName(metaName || session.user.email.split('@')[0])

    const savedTheme = localStorage.getItem('bloommate-theme')
    const isDark = savedTheme === 'dark'
    setDarkMode(isDark)
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

  function handleToggleDarkMode() {
    const newValue = !darkMode
    setDarkMode(newValue)
    if (newValue) {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('bloommate-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.setItem('bloommate-theme', 'light')
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
        </div>

        <div className="profile-section">
          <p className="profile-section-title">Settings</p>
          <div className="profile-card">
            <div className="profile-row">
              <div className="profile-row-label">
                {darkMode ? <IconMoon size={20} /> : <IconSun size={20} />}
                <span>Dark mode</span>
              </div>
              <button className={`profile-toggle ${darkMode ? 'is-on' : ''}`} onClick={handleToggleDarkMode}>
                <span className="profile-toggle-knob" />
              </button>
            </div>
          </div>
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