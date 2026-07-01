import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  IconArrowLeft, IconDroplet, IconSun, IconRefresh, IconGauge,
  IconPencil, IconTrash, IconCheck, IconX, IconLeaf, IconScissors,
  IconChevronRight, IconChevronDown, IconChevronUp, IconBell, IconBellOff,
  IconCamera, IconPlus, IconSeeding, IconWind
} from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { formatRelativeDay, formatTime, isToday, getLocalDateString } from '../lib/dateUtils'
import { uploadPlantPhoto, getMainPhoto, getSignedUrl } from '../lib/photos'
import { checkAndUnlockAchievements } from '../lib/achievements'
import sadMascot from '../assets/mascot/sad.png'
import './PlantDetail.css'
import PhotoLightbox from '../components/PhotoLightbox'

const CARE_ACTIONS = [
  { key: 'water', label: 'Water', icon: IconDroplet },
  { key: 'fertilize', label: 'Fertilize', icon: IconLeaf },
  { key: 'cut', label: 'Cut', icon: IconScissors },
]

const OTHER_CHIPS = ['Repotting', 'Misting', 'Pest Control', 'Cleaning leaves', 'Propagation', 'Deadheading']

const WATERING_TO_DAYS = { 'frequent': 1, 'average': 3, 'minimum': 7, 'none': null }
function defaultFrequencyDays(wateringText) {
  if (!wateringText) return 3
  return WATERING_TO_DAYS[wateringText.toLowerCase().trim()] ?? 3
}

const WATERING_LABELS = {
  frequent: 'Frequent',
  average: 'Average',
  minimum: 'Minimum',
  'soak and dry': 'Soak & Dry',
  'soak & dry': 'Soak & Dry',
  none: 'None',
}
function friendlyWatering(raw) {
  if (!raw) return null
  const key = raw.toLowerCase().trim()
  return WATERING_LABELS[key] || raw
}

const SUNLIGHT_KEYWORDS = [
  { match: 'full sun', label: 'Full Sun' },
  { match: 'part shade', label: 'Part Shade' },
  { match: 'part sun', label: 'Part Shade' },
  { match: 'filtered shade', label: 'Indirect' },
  { match: 'filtered sun', label: 'Indirect' },
  { match: 'full shade', label: 'Low Light' },
  { match: 'indirect', label: 'Indirect' },
  { match: 'shade', label: 'Low Light' },
]
function friendlySunlight(raw) {
  if (!raw) return null
  const key = raw.toLowerCase()
  for (const { match, label } of SUNLIGHT_KEYWORDS) {
    if (key.includes(match)) return label
  }
  return raw
}

const DIFFICULTY_META = {
  easy: { emoji: '🟢', label: 'Easy' },
  moderate: { emoji: '🟡', label: 'Moderate' },
  medium: { emoji: '🟡', label: 'Moderate' },
  advanced: { emoji: '🔴', label: 'Advanced' },
  difficult: { emoji: '🔴', label: 'Advanced' },
}
function difficultyBadge(careLevel) {
  if (!careLevel) return null
  const key = careLevel.toLowerCase().trim()
  return DIFFICULTY_META[key] || { emoji: '🟢', label: careLevel }
}

function formatHour(hour) {
  const h = hour % 12 === 0 ? 12 : hour % 12
  const suffix = hour < 12 ? 'AM' : 'PM'
  return `${h}:00 ${suffix}`
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i)

export default function PlantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [plant, setPlant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [loggingAction, setLoggingAction] = useState(null)
  const [logError, setLogError] = useState(null)
  const [reminderSaving, setReminderSaving] = useState(false)
  const [mainPhotoUrl, setMainPhotoUrl] = useState(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoMessage, setPhotoMessage] = useState(null)
  const fileInputRef = useRef(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)

  // NEW: passport accordion
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)

  // NEW: Other logging modal
  const [otherModalOpen, setOtherModalOpen] = useState(false)
  const [otherSelectedChip, setOtherSelectedChip] = useState(null)
  const [otherCustomText, setOtherCustomText] = useState('')
  const [otherSaving, setOtherSaving] = useState(false)
  const [otherError, setOtherError] = useState(null)

  // NEW: smart suggestion banner
  const [suggestionBanner, setSuggestionBanner] = useState({ visible: false, text: '' })

  useEffect(() => { fetchPlant(); fetchLogs(); fetchMainPhoto() }, [id])

  async function fetchPlant() {
    setLoading(true); setError(null)
    const { data, error } = await supabase.from('plants').select('*').eq('id', id).single()
    if (error) setError("Couldn't find that plant.")
    else setPlant(data)
    setLoading(false)
  }

  async function fetchLogs() {
    setLogsLoading(true)
    const { data, error } = await supabase.from('care_logs').select('*').eq('plant_id', id).order('logged_at', { ascending: false }).limit(30)
    if (!error) setLogs(data)
    setLogsLoading(false)
  }

  async function fetchMainPhoto() {
    try {
      const photo = await getMainPhoto(id)
      if (photo) {
        const url = await getSignedUrl(photo.storage_path)
        setMainPhotoUrl(url)
      } else {
        setMainPhotoUrl(null)
      }
    } catch (err) {
      console.error('Could not load main photo:', err)
    }
  }

  function handlePhotoButtonClick() {
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setPhotoUploading(true)
    setPhotoMessage(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await uploadPlantPhoto(user.id, id, file)
      await fetchMainPhoto()
      const unlocked = await checkAndUnlockAchievements(user.id)
      setPhotoMessage(unlocked.includes('bloom-cam') ? 'Photo added! 🎉 Bloom Cam unlocked!' : 'Photo added!')
    } catch (err) {
      setPhotoMessage('Could not upload photo. Please try again.')
    } finally {
      setPhotoUploading(false)
      setTimeout(() => setPhotoMessage(null), 4000)
    }
  }

  async function handleLogCare(action) {
    setLoggingAction(action); setLogError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('care_logs').insert({ plant_id: id, user_id: user.id, action }).select().single()
      if (error) throw error
      setLogs((prev) => [data, ...prev])
      const { error: streakError } = await supabase.rpc('bump_streak', { p_today: getLocalDateString() })
      if (streakError) console.error('Streak update failed:', streakError)
    } catch (err) {
      setLogError('Could not log that. Please try again.')
    } finally {
      setLoggingAction(null)
    }
  }

  // NEW: log an "Other" custom action
  async function handleLogOther() {
    const label = otherCustomText.trim() || otherSelectedChip
    if (!label) return
    setOtherSaving(true)
    setOtherError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('care_logs')
        .insert({ plant_id: id, user_id: user.id, action: 'custom', custom_action: label })
        .select()
        .single()
      if (error) throw error
      setLogs((prev) => [data, ...prev])
      const { error: streakError } = await supabase.rpc('bump_streak', { p_today: getLocalDateString() })
      if (streakError) console.error('Streak update failed:', streakError)

      setOtherModalOpen(false)
      setOtherSelectedChip(null)
      setOtherCustomText('')

      if (label.toLowerCase() === 'repotting') {
        setSuggestionBanner({
          visible: true,
          text: `🌿 You repotted ${plant.nickname}! Set a reminder to fertilize in 2 weeks?`,
        })
      }
    } catch (err) {
      setOtherError('Could not log that. Please try again.')
    } finally {
      setOtherSaving(false)
    }
  }

  // NEW: accept the smart suggestion — turns on the plant's reminder at 14 days
  async function handleAcceptSuggestion() {
    const updates = {
      reminder_enabled: true,
      reminder_frequency_days: 14,
      reminder_time_hour: plant.reminder_time_hour ?? 8,
    }
    const { data, error } = await supabase.from('plants').update(updates).eq('id', id).select().single()
    if (!error) setPlant(data)
    setSuggestionBanner({ visible: false, text: '' })
  }

  function handleDismissSuggestion() {
    setSuggestionBanner({ visible: false, text: '' })
  }

  async function handleToggleReminder() {
    if (!plant) return
    setReminderSaving(true)
    const turningOn = !plant.reminder_enabled
    const updates = {
      reminder_enabled: turningOn,
      reminder_frequency_days: plant.reminder_frequency_days ?? defaultFrequencyDays(plant.watering),
      reminder_time_hour: plant.reminder_time_hour ?? 8,
    }
    const { data, error } = await supabase.from('plants').update(updates).eq('id', id).select().single()
    if (!error) setPlant(data)
    setReminderSaving(false)
  }

  async function handleReminderTime(hour) {
    const { data, error } = await supabase.from('plants').update({ reminder_time_hour: hour }).eq('id', id).select().single()
    if (!error) setPlant(data)
  }

  async function handleReminderFrequency(days) {
    const { data, error } = await supabase.from('plants').update({ reminder_frequency_days: days }).eq('id', id).select().single()
    if (!error) setPlant(data)
  }

  function startEdit() {
    setForm({ nickname: plant.nickname || '', common_name: plant.common_name || '', scientific_name: plant.scientific_name || '', watering: plant.watering || '', sunlight: plant.sunlight || '', cycle: plant.cycle || '', care_level: plant.care_level || '' })
    setSaveError(null); setEditing(true)
  }

  function updateField(field, value) { setForm((prev) => ({ ...prev, [field]: value })) }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!form.nickname.trim()) return
    setSaving(true); setSaveError(null)
    try {
      const { data, error } = await supabase.from('plants').update({ nickname: form.nickname.trim(), common_name: form.common_name || null, scientific_name: form.scientific_name || null, watering: form.watering || null, sunlight: form.sunlight || null, cycle: form.cycle || null, care_level: form.care_level || null }).eq('id', id).select().single()
      if (error) throw error
      setPlant(data); setEditing(false)
    } catch (err) {
      setSaveError('Could not save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true); setDeleteError(null)
    try {
      const { error } = await supabase.from('plants').delete().eq('id', id)
      if (error) throw error
      navigate('/')
    } catch (err) {
      setDeleteError('Could not delete this plant. Please try again.')
      setDeleting(false)
    }
  }

  function scrollToProfile() {
    setProfileOpen(true)
    setTimeout(() => profileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  if (loading) return <div className="plantdetail-page"><div className="plantdetail-header"><button className="plantdetail-back" onClick={() => navigate('/')}><IconArrowLeft size={22} /></button></div><p className="plantdetail-loading">Loading...</p></div>
  if (error) return <div className="plantdetail-page"><div className="plantdetail-header"><button className="plantdetail-back" onClick={() => navigate('/')}><IconArrowLeft size={22} /></button></div><p className="plantdetail-error">{error}</p></div>
  if (!plant) return null

  if (confirmingDelete) {
    return (
      <div className="plantdetail-page">
        <div className="plantdetail-confirm">
          <img src={sadMascot} alt="BloomMate looking sad" className="plantdetail-confirm-mascot" />
          <h2>Delete {plant.nickname}?</h2>
          <p>This can't be undone.</p>
          {deleteError && <p className="plantdetail-error">{deleteError}</p>}
          <div className="plantdetail-confirm-actions">
            <button className="plantdetail-cancel-btn" onClick={() => setConfirmingDelete(false)} disabled={deleting}>Keep it</button>
            <button className="plantdetail-delete-btn" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
          </div>
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="plantdetail-page">
        <div className="plantdetail-header">
          <button className="plantdetail-back" onClick={() => setEditing(false)}><IconX size={22} /></button>
          <h1>Edit plant</h1>
        </div>
        <form className="plantdetail-form" onSubmit={handleSaveEdit}>
          <label>Nickname *<input type="text" value={form.nickname} onChange={(e) => updateField('nickname', e.target.value)} required /></label>
          <label>Common name<input type="text" value={form.common_name} onChange={(e) => updateField('common_name', e.target.value)} /></label>
          <label>Scientific name<input type="text" value={form.scientific_name} onChange={(e) => updateField('scientific_name', e.target.value)} /></label>
          <label>Watering<input type="text" value={form.watering} onChange={(e) => updateField('watering', e.target.value)} placeholder="e.g. Average" /></label>
          <label>Sunlight<input type="text" value={form.sunlight} onChange={(e) => updateField('sunlight', e.target.value)} placeholder="e.g. Full sun" /></label>
          <label>Cycle<input type="text" value={form.cycle} onChange={(e) => updateField('cycle', e.target.value)} placeholder="e.g. Perennial" /></label>
          <label>Care level<input type="text" value={form.care_level} onChange={(e) => updateField('care_level', e.target.value)} placeholder="e.g. Easy" /></label>
          {saveError && <p className="plantdetail-error">{saveError}</p>}
          <button type="submit" className="plantdetail-save-btn" disabled={saving}><IconCheck size={18} />{saving ? 'Saving...' : 'Save changes'}</button>
        </form>
      </div>
    )
  }

  const lastByAction = {}
  for (const log of logs) { if (!lastByAction[log.action]) lastByAction[log.action] = log }
  const reminderHour = plant.reminder_time_hour ?? 8
  const reminderDays = plant.reminder_frequency_days ?? defaultFrequencyDays(plant.watering)
  const isCustomHour = reminderHour !== 8 && reminderHour !== 18
  const showCustomPicker = customOpen || isCustomHour
  const displayImage = mainPhotoUrl || plant.image_url

  const diffBadge = difficultyBadge(plant.care_level)
  const wateringFriendly = friendlyWatering(plant.watering)
  const sunlightFriendly = friendlySunlight(plant.sunlight)
  const wateringDays = plant.watering ? defaultFrequencyDays(plant.watering) : null

  return (
    <div className="plantdetail-page">
      <div className="plantdetail-header">
        <button className="plantdetail-back" onClick={() => navigate('/')}><IconArrowLeft size={22} /></button>
        <h1>{plant.nickname}</h1>
        <div className="plantdetail-header-actions">
          <button className="plantdetail-icon-btn" onClick={startEdit}><IconPencil size={20} /></button>
          <button className="plantdetail-icon-btn plantdetail-icon-btn-danger" onClick={() => setConfirmingDelete(true)}><IconTrash size={20} /></button>
        </div>
      </div>

      <div className="plantdetail-photo-wrap">
        {displayImage
          ? <img src={displayImage} alt={plant.nickname} className="plantdetail-image" onClick={() => setLightboxOpen(true)} style={{ cursor: 'zoom-in' }} />
          : <div className="plantdetail-noimg">🌿</div>}

        {diffBadge && (
          <div className="plantdetail-badge-topleft">
            <span className="plantdetail-badge">{diffBadge.emoji} {diffBadge.label}</span>
          </div>
        )}

        <button className="plantdetail-photo-btn" onClick={handlePhotoButtonClick} disabled={photoUploading}>
          <IconCamera size={16} />{photoUploading ? 'Uploading...' : 'Add photo'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelected} />
      </div>
      {lightboxOpen && <PhotoLightbox src={displayImage} onClose={() => setLightboxOpen(false)} />}
      {photoMessage && <p className="plantdetail-photo-message">{photoMessage}</p>}

      {(plant.common_name || plant.scientific_name) && (
        <div className="plantdetail-names">
          {plant.common_name && <p className="plantdetail-common">{plant.common_name}</p>}
          {plant.scientific_name && <p className="plantdetail-sci">{plant.scientific_name}</p>}
        </div>
      )}

      {/* 4-Card Passport */}
      <div className="plantdetail-passport">
        <button className="plantdetail-passport-card" onClick={scrollToProfile}>
          <div className="plantdetail-passport-emoji">💧</div>
          <p className="plantdetail-passport-label">Watering</p>
          <p className="plantdetail-passport-value">{wateringFriendly || '—'}</p>
        </button>
        <button className="plantdetail-passport-card" onClick={scrollToProfile}>
          <div className="plantdetail-passport-emoji">☀️</div>
          <p className="plantdetail-passport-label">Sunlight</p>
          <p className="plantdetail-passport-value">{sunlightFriendly || '—'}</p>
        </button>
        <button className="plantdetail-passport-card" onClick={scrollToProfile}>
          <div className="plantdetail-passport-emoji">🌱</div>
          <p className="plantdetail-passport-label">Soil</p>
          <p className="plantdetail-passport-value">—</p>
        </button>
        <button className="plantdetail-passport-card" onClick={scrollToProfile}>
          <div className="plantdetail-passport-emoji">💨</div>
          <p className="plantdetail-passport-label">Humidity</p>
          <p className="plantdetail-passport-value">—</p>
        </button>
      </div>

      {/* Expandable Full Plant Profile */}
      <div className="plantdetail-accordion" ref={profileRef}>
        <button className="plantdetail-accordion-header" onClick={() => setProfileOpen((v) => !v)}>
          <span>📖 Full Plant Profile</span>
          {profileOpen ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
        </button>
        {profileOpen && (
          <div className="plantdetail-accordion-body">
            <div className="plantdetail-accordion-item">
              <strong>Watering:</strong> {wateringFriendly || 'Information not added yet'}
              {wateringDays && ` — water roughly every ${wateringDays} day${wateringDays === 1 ? '' : 's'}.`}
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Sunlight:</strong> {sunlightFriendly || 'Information not added yet'}
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Cycle:</strong> {plant.cycle || 'Information not added yet'}
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Care level:</strong> {plant.care_level || 'Information not added yet'}
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Soil pH:</strong> Information not added yet
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Temperature range:</strong> Information not added yet
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Fertilizer schedule:</strong> Information not added yet
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Pruning advice:</strong> Information not added yet
            </div>
          </div>
        )}
      </div>

      <h3 className="plantdetail-section-title">Log care</h3>
      <div className="plantdetail-careactions">
        {CARE_ACTIONS.map(({ key, label, icon: Icon }) => {
          const last = lastByAction[key]
          const doneToday = last && isToday(last.logged_at)
          const isLogging = loggingAction === key
          return (
            <button key={key} className={`plantdetail-careaction-btn ${doneToday ? 'is-done' : ''}`} onClick={() => handleLogCare(key)} disabled={doneToday || isLogging}>
              {doneToday ? <IconCheck size={22} /> : <Icon size={22} />}
              <span className="plantdetail-careaction-label">{label}</span>
              <span className="plantdetail-careaction-sub">
                {isLogging ? 'Logging...' : doneToday ? 'Done today' : last ? `Last: ${formatRelativeDay(last.logged_at)}` : 'Not logged yet'}
              </span>
            </button>
          )
        })}
        <button className="plantdetail-careaction-btn" onClick={() => setOtherModalOpen(true)}>
          <IconPlus size={22} />
          <span className="plantdetail-careaction-label">Other</span>
          <span className="plantdetail-careaction-sub">Log something else</span>
        </button>
      </div>
      {logError && <p className="plantdetail-error">{logError}</p>}

      {/* Other logging modal */}
      {otherModalOpen && (
        <div className="plantdetail-modal-overlay" onClick={() => setOtherModalOpen(false)}>
          <div className="plantdetail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="plantdetail-modal-header">
              <h3>Log an action</h3>
              <button className="plantdetail-modal-close" onClick={() => setOtherModalOpen(false)}><IconX size={20} /></button>
            </div>
            <div className="plantdetail-chip-row">
              {OTHER_CHIPS.map((chip) => (
                <button
                  key={chip}
                  className={`plantdetail-chip ${otherSelectedChip === chip ? 'is-selected' : ''}`}
                  onClick={() => { setOtherSelectedChip(chip); setOtherCustomText('') }}
                >
                  {chip}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="plantdetail-modal-input"
              placeholder="Or type your own action..."
              value={otherCustomText}
              onChange={(e) => { setOtherCustomText(e.target.value); setOtherSelectedChip(null) }}
            />
            {otherError && <p className="plantdetail-error">{otherError}</p>}
            <button
              className="plantdetail-save-btn"
              style={{ marginTop: 16 }}
              onClick={handleLogOther}
              disabled={otherSaving || (!otherSelectedChip && !otherCustomText.trim())}
            >
              <IconCheck size={18} />{otherSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Smart suggestion banner */}
      {suggestionBanner.visible && (
        <div className="plantdetail-suggestion-banner">
          <p>{suggestionBanner.text}</p>
          <div className="plantdetail-suggestion-actions">
            <button className="plantdetail-suggestion-yes" onClick={handleAcceptSuggestion}>Yes, Add Reminder</button>
            <button className="plantdetail-suggestion-no" onClick={handleDismissSuggestion}>No thanks</button>
          </div>
        </div>
      )}

      <h3 className="plantdetail-section-title">Watering reminder</h3>
      <div className="plantdetail-reminder-card">
        <div className="plantdetail-reminder-row">
          <div className="plantdetail-reminder-label">
            {plant.reminder_enabled ? <IconBell size={18} /> : <IconBellOff size={18} />}
            <span>{plant.reminder_enabled ? 'Reminder on' : 'Reminder off'}</span>
          </div>
          <button className={`plantdetail-reminder-toggle ${plant.reminder_enabled ? 'is-on' : ''}`} onClick={handleToggleReminder} disabled={reminderSaving}>
            <span className="plantdetail-reminder-toggle-knob" />
          </button>
        </div>
        {plant.reminder_enabled && (
          <>
            <div className="plantdetail-reminder-divider" />
            <p className="plantdetail-reminder-sublabel">Remind me · {formatHour(reminderHour)}</p>
            <div className="plantdetail-reminder-time-btns">
              <button className={`plantdetail-reminder-time-btn ${reminderHour === 8 ? 'is-selected' : ''}`} onClick={() => { handleReminderTime(8); setCustomOpen(false) }}>
                🌅 Morning
                <span className="plantdetail-reminder-time-sub">8:00 AM</span>
              </button>
              <button className={`plantdetail-reminder-time-btn ${reminderHour === 18 ? 'is-selected' : ''}`} onClick={() => { handleReminderTime(18); setCustomOpen(false) }}>
                🌆 Evening
                <span className="plantdetail-reminder-time-sub">6:00 PM</span>
              </button>
              <button className={`plantdetail-reminder-time-btn ${showCustomPicker ? 'is-selected' : ''}`} onClick={() => setCustomOpen(true)}>
                ⏰ Custom
                <span className="plantdetail-reminder-time-sub">{isCustomHour ? formatHour(reminderHour) : 'Pick time'}</span>
              </button>
            </div>

            {showCustomPicker && (
              <select
                className="plantdetail-hour-select"
                value={reminderHour}
                onChange={(e) => handleReminderTime(Number(e.target.value))}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{formatHour(h)}</option>
                ))}
              </select>
            )}

            <p className="plantdetail-reminder-sublabel" style={{ marginTop: 12 }}>Every</p>
            <div className="plantdetail-reminder-freq-btns">
              {[1, 2, 3, 5, 7, 14].map((d) => (
                <button key={d} className={`plantdetail-reminder-freq-btn ${reminderDays === d ? 'is-selected' : ''}`} onClick={() => handleReminderFrequency(d)}>
                  {d === 1 ? 'day' : `${d}d`}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="plantdetail-activity">
        <div className="plantdetail-activity-header">
          <h3>Recent activity</h3>
          <button className="plantdetail-activity-seeall" onClick={() => navigate(`/plant/${id}/history`)}>See all <IconChevronRight size={16} /></button>
        </div>
        {logsLoading ? <p className="plantdetail-activity-empty">Loading...</p>
          : logs.length === 0 ? <p className="plantdetail-activity-empty">No activity logged yet.</p>
          : (
            <div className="plantdetail-activity-list">
              {logs.slice(0, 5).map((log) => {
                const isCustom = log.action === 'custom'
                const meta = !isCustom ? CARE_ACTIONS.find((a) => a.key === log.action) : null
                const Icon = meta?.icon
                return (
                  <div key={log.id} className="plantdetail-activity-row">
                    <span className="plantdetail-activity-icon">{isCustom ? '📌' : <Icon size={16} />}</span>
                    <span className="plantdetail-activity-label">{isCustom ? (log.custom_action || 'Other') : meta.label}</span>
                    <span className="plantdetail-activity-time">{formatRelativeDay(log.logged_at)} · {formatTime(log.logged_at)}</span>
                  </div>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}