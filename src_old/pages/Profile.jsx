import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  IconUserCircle, IconPencil, IconCheck, IconX, IconLogout, IconBell,
  IconChevronRight, IconShare, IconCopy, IconBrandWhatsapp, IconBrandX,
} from "@tabler/icons-react"
import BottomNav from '../components/BottomNav'
import './Profile.css'

import chillAvatar from '../assets/avatars/chill.png'
import dirtAvatar from '../assets/avatars/dirt.png'
import florAvatar from '../assets/avatars/flor.png'
import grumpAvatar from '../assets/avatars/grump.png'
import profaAvatar from '../assets/avatars/profa.png'
import techAvatar from '../assets/avatars/tech.png'

const AVATARS = [
  { id: 'chill', src: chillAvatar },
  { id: 'dirt', src: dirtAvatar },
  { id: 'flor', src: florAvatar },
  { id: 'grump', src: grumpAvatar },
  { id: 'profa', src: profaAvatar },
  { id: 'tech', src: techAvatar },
]

const APP_URL = 'https://bloommateapp.netlify.app'
const SHARE_TEXT = "I'm growing my plant collection with BloomMate 🌱 Come check it out!"

function formatMemberSince(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function avatarSrcFor(avatarId) {
  return AVATARS.find((a) => a.id === avatarId)?.src || null
}

export default function Profile({ session }) {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState(null)
  const [signingOut, setSigningOut] = useState(false)

  const [avatarId, setAvatarId] = useState(null)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)

  const [shareFallbackOpen, setShareFallbackOpen] = useState(false)
  const [copyMessage, setCopyMessage] = useState(null)

  useEffect(() => {
    const metaName = session.user.user_metadata?.display_name
    setDisplayName(metaName || session.user.email.split('@')[0])
    setAvatarId(session.user.user_metadata?.avatar_id || null)
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

  async function handleSelectAvatar(id) {
    setSavingAvatar(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { avatar_id: id },
      })
      if (error) throw error
      setAvatarId(id)
      setAvatarPickerOpen(false)
    } catch (err) {
      // keep the picker open so they can retry
    } finally {
      setSavingAvatar(false)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    navigate('/auth')
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'BloomMate', text: SHARE_TEXT, url: APP_URL })
      } catch (err) {
        // user cancelled the share sheet — nothing to do
      }
    } else {
      setShareFallbackOpen(true)
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(APP_URL)
      setCopyMessage('Link copied!')
    } catch (err) {
      setCopyMessage('Could not copy link.')
    } finally {
      setTimeout(() => setCopyMessage(null), 2500)
    }
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${APP_URL}`)}`
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(APP_URL)}`
  const currentAvatarSrc = avatarSrcFor(avatarId)

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
            {currentAvatarSrc
              ? <img src={currentAvatarSrc} alt="Your avatar" className="profile-avatar-img" />
              : <IconUserCircle size={56} />}
          </div>
          <button className="profile-avatar-change-btn" onClick={() => setAvatarPickerOpen(true)}>
            Change
          </button>

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
          <p className="profile-section-title">Spread the word</p>
          <button className="profile-share-btn" onClick={handleShare}>
            <IconShare size={18} />
            Share BloomMate
          </button>
          {copyMessage && <p className="profile-copy-message">{copyMessage}</p>}
        </div>

        <div className="profile-section">
          <button className="profile-signout-btn" onClick={handleSignOut} disabled={signingOut}>
            <IconLogout size={18} />
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </main>

      {avatarPickerOpen && (
        <div className="profile-modal-overlay" onClick={() => setAvatarPickerOpen(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Choose your avatar</h3>
              <button className="profile-modal-close" onClick={() => setAvatarPickerOpen(false)}><IconX size={20} /></button>
            </div>
            <div className="profile-avatar-grid">
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  className={`profile-avatar-option ${avatarId === a.id ? 'is-selected' : ''}`}
                  onClick={() => handleSelectAvatar(a.id)}
                  disabled={savingAvatar}
                >
                  <img src={a.src} alt={a.id} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {shareFallbackOpen && (
        <div className="profile-modal-overlay" onClick={() => setShareFallbackOpen(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Share BloomMate</h3>
              <button className="profile-modal-close" onClick={() => setShareFallbackOpen(false)}><IconX size={20} /></button>
            </div>
            <div className="profile-share-options">
              <a className="profile-share-option" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <IconBrandWhatsapp size={20} /> WhatsApp
              </a>
              <a className="profile-share-option" href={xUrl} target="_blank" rel="noopener noreferrer">
                <IconBrandX size={20} /> X
              </a>
              <button className="profile-share-option" onClick={handleCopyLink}>
                <IconCopy size={20} /> Copy link
              </button>
            </div>
            {copyMessage && <p className="profile-copy-message">{copyMessage}</p>}
          </div>
        </div>
      )}

      <BottomNav active="profile" />
    </div>
  )
}