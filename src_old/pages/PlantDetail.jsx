import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  IconArrowLeft, IconDroplet, IconSun, IconRefresh, IconGauge,
  IconPencil, IconTrash, IconCheck, IconX, IconLeaf, IconScissors,
  IconChevronRight, IconChevronDown, IconChevronUp, IconBell, IconBellOff,
  IconCamera, IconPlus, IconSeeding, IconWind, IconStethoscope
} from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { formatRelativeDay, formatTime, isToday, getLocalDateString } from '../lib/dateUtils'
import { uploadPlantPhoto, getMainPhoto, getSignedUrl } from '../lib/photos'
import { checkAndUnlockAchievements } from '../lib/achievements'
import {
  WATERING_OPTIONS, SUNLIGHT_OPTIONS, SOIL_TYPE_OPTIONS, HUMIDITY_OPTIONS,
  PH_LEVEL_OPTIONS, FERTILIZER_FREQUENCY_OPTIONS, PRUNING_FREQUENCY_OPTIONS,
  CYCLE_OPTIONS, DIFFICULTY_OPTIONS, labelFor,
} from '../lib/plantFields'
import sadMascot from '../assets/mascot/sad.png'
import './PlantDetail.css'
import PhotoLightbox from '../components/PhotoLightbox'

const CARE_ACTIONS = [
  { key: 'water', label: 'Water', icon: IconDroplet },
  { key: 'fertilize', label: 'Fertilize', icon: IconLeaf },
  { key: 'cut', label: 'Cut', icon: IconScissors },
]

const CARE_GUIDE_META = [
  { key: 'watering', emoji: '💧', label: 'Watering' },
  { key: 'sunlight', emoji: '☀️', label: 'Sunlight' },
  { key: 'pruning', emoji: '✂️', label: 'Pruning' },
]

const OTHER_CHIPS = ['Repotting', 'Misting', 'Pest Control', 'Cleaning leaves', 'Propagation', 'Deadheading']

const WATERING_TO_DAYS = { 'frequent': 1, 'average': 3, 'minimum': 7, 'none': null, 'soak_and_dry': 10, 'bottom_water': 4 }
function defaultFrequencyDays(wateringText) {
  if (!wateringText) return null
  return WATERING_TO_DAYS[wateringText.toLowerCase().trim()] ?? null
}

const WATERING_LABELS = {
  frequent: 'Frequent',
  average: 'Average',
  minimum: 'Minimum',
  'soak and dry': 'Soak & Dry',
  'soak & dry': 'Soak & Dry',
  'bottom water': 'Bottom Water',
  none: 'None',
}
function legacyWateringLabel(raw) {
  if (!raw) return null
  const key = raw.toLowerCase().trim().replace(/[_-]/g, ' ')
  return WATERING_LABELS[key] || raw
}
function displayWatering(raw) {
  if (!raw) return null
  const exact = labelFor(WATERING_OPTIONS, raw)
  if (exact && exact !== raw) return exact
  return legacyWateringLabel(raw)
}

const SUNLIGHT_LABELS = {
  'full sun': 'Full Sun',
  'sun part shade': 'Sun / Part Shade',
  'part shade': 'Part Shade',
  'full shade': 'Full Shade',
  'bright indirect': 'Bright Indirect',
  'low light': 'Low Light',
  'morning sun': 'Morning Sun',
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
function legacySunlightLabel(raw) {
  if (!raw) return null
  const key = raw.toLowerCase().trim().replace(/[_-]/g, ' ').replace(/\s+/g, ' ')
  if (SUNLIGHT_LABELS[key]) return SUNLIGHT_LABELS[key]
  for (const { match, label } of SUNLIGHT_KEYWORDS) {
    if (key.includes(match)) return label
  }
  return raw
}
function displaySunlight(raw) {
  if (!raw) return null
  const exact = labelFor(SUNLIGHT_OPTIONS, raw)
  if (exact && exact !== raw) return exact
  return legacySunlightLabel(raw)
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

function toxicityBadge(plant) {
  if (plant.poisonous_to_pets === null || plant.poisonous_to_pets === undefined) return null
  return plant.poisonous_to_pets
    ? { emoji: '⚠️', label: 'Toxic to pets' }
    : { emoji: '🐶', label: 'Safe for pets' }
}

function humanToxicityBadge(plant) {
  if (!plant.poisonous_to_humans) return null
  return { emoji: '☣️', label: 'Toxic to humans' }
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

  // per-care-type reminders (water / custom)
  const [reminders, setReminders] = useState({ water: null, custom: null })
  const [remindersLoading, setRemindersLoading] = useState(true)
  const [reminderSaving, setReminderSaving] = useState({ water: false, custom: false })
  const [customOpen, setCustomOpen] = useState({ water: false, custom: false })

  const [mainPhotoUrl, setMainPhotoUrl] = useState(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoMessage, setPhotoMessage] = useState(null)
  const fileInputRef = useRef(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)

  const [otherModalOpen, setOtherModalOpen] = useState(false)
  const [otherSelectedChip, setOtherSelectedChip] = useState(null)
  const [otherCustomText, setOtherCustomText] = useState('')
  const [otherSaving, setOtherSaving] = useState(false)
  const [otherError, setOtherError] = useState(null)

  const [suggestionBanner, setSuggestionBanner] = useState({ visible: false, text: '' })

  // Plant Doctor diagnoses linked to care_log entries (shown via Activity/History)
  const [doctorNotes, setDoctorNotes] = useState({})
  const [expandedLogId, setExpandedLogId] = useState(null)

  // plant notes
  const [notes, setNotes] = useState([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [addingNote, setAddingNote] = useState(false)
  const [newNoteText, setNewNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [noteError, setNoteError] = useState(null)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editNoteText, setEditNoteText] = useState('')
  const [savingEditNote, setSavingEditNote] = useState(false)

  useEffect(() => { fetchPlant(); fetchLogs(); fetchMainPhoto(); fetchNotes(); fetchReminders(); fetchDoctorNotes() }, [id])

  async function fetchDoctorNotes() {
    const { data, error } = await supabase
      .from('plant_notes')
      .select('*')
      .eq('plant_id', id)
      .eq('source', 'plant_doctor')
    if (!error && data) {
      const map = {}
      data.forEach((n) => { if (n.care_log_id) map[n.care_log_id] = n })
      setDoctorNotes(map)
    }
  }

  async function handleDeleteDoctorNote(logId) {
    const note = doctorNotes[logId]
    if (!note) return
    try {
      const { error } = await supabase.from('plant_notes').delete().eq('id', note.id)
      if (error) throw error
      setDoctorNotes((prev) => {
        const next = { ...prev }
        delete next[logId]
        return next
      })
      setExpandedLogId(null)
    } catch (err) {
      console.error('Could not delete diagnosis:', err)
    }
  }

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

  async function fetchReminders() {
    setRemindersLoading(true)
    const { data, error } = await supabase.from('plant_reminders').select('*').eq('plant_id', id)
    if (!error && data) {
      const water = data.find((r) => r.care_type === 'water') || null
      const custom = data.find((r) => r.care_type === 'custom') || null
      setReminders({ water, custom })
    }
    setRemindersLoading(false)
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

  // ---- Reminder helpers (per-care-type: water / custom) ----

  async function upsertReminder(careType, updates) {
    const existing = reminders[careType]
    try {
      if (existing) {
        const { data, error } = await supabase
          .from('plant_reminders')
          .update(updates)
          .eq('id', existing.id)
          .select()
          .single()
        if (error) throw error
        setReminders((prev) => ({ ...prev, [careType]: data }))
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { data, error } = await supabase
          .from('plant_reminders')
          .insert({ plant_id: id, user_id: user.id, care_type: careType, ...updates })
          .select()
          .single()
        if (error) throw error
        setReminders((prev) => ({ ...prev, [careType]: data }))
      }
    } catch (err) {
      console.error('Could not save reminder:', err)
    }
  }

  async function handleAcceptSuggestion() {
    const existing = reminders.custom
    await upsertReminder('custom', {
      enabled: true,
      frequency_days: 14,
      time_hour: existing?.time_hour ?? 8,
    })
    setSuggestionBanner({ visible: false, text: '' })
  }

  function handleDismissSuggestion() {
    setSuggestionBanner({ visible: false, text: '' })
  }

  async function handleToggleReminder(careType) {
    setReminderSaving((prev) => ({ ...prev, [careType]: true }))
    const existing = reminders[careType]
    const turningOn = !existing?.enabled
    let frequency = existing?.frequency_days ?? null
    // Smart suggestion only for Water, only when plant has Perenual watering data, only if not already set
    if (turningOn && frequency == null && careType === 'water' && plant.watering) {
      frequency = defaultFrequencyDays(plant.watering)
    }
    await upsertReminder(careType, {
      enabled: turningOn,
      time_hour: existing?.time_hour ?? 8,
      frequency_days: frequency,
    })
    setReminderSaving((prev) => ({ ...prev, [careType]: false }))
  }

  async function handleReminderTime(careType, hour) {
    await upsertReminder(careType, { time_hour: hour })
  }

  async function handleReminderFrequency(careType, days) {
    await upsertReminder(careType, { frequency_days: days })
  }

  function startEdit() {
    setForm({
      nickname: plant.nickname || '',
      common_name: plant.common_name || '',
      scientific_name: plant.scientific_name || '',
      watering: plant.watering || '',
      sunlight: plant.sunlight || '',
      soil_type: plant.soil_type || '',
      humidity: plant.humidity || '',
      ph_level: plant.ph_level || '',
      temp_min: plant.temp_min ?? '',
      temp_max: plant.temp_max ?? '',
      fertilizer_frequency: plant.fertilizer_frequency || '',
      pruning_frequency: plant.pruning_frequency || '',
      cycle: plant.cycle || '',
      care_level: plant.care_level || '',
      poisonous_to_pets: Boolean(plant.poisonous_to_pets),
      poisonous_to_humans: Boolean(plant.poisonous_to_humans),
    })
    setSaveError(null); setEditing(true)
  }

  function updateField(field, value) { setForm((prev) => ({ ...prev, [field]: value })) }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!form.nickname.trim()) return
    setSaving(true); setSaveError(null)
    try {
      const { data, error } = await supabase.from('plants').update({
        nickname: form.nickname.trim(),
        common_name: form.common_name || null,
        scientific_name: form.scientific_name || null,
        watering: form.watering || null,
        sunlight: form.sunlight || null,
        soil_type: form.soil_type || null,
        humidity: form.humidity || null,
        ph_level: form.ph_level || null,
        temp_min: form.temp_min === '' ? null : Number(form.temp_min),
        temp_max: form.temp_max === '' ? null : Number(form.temp_max),
        fertilizer_frequency: form.fertilizer_frequency || null,
        pruning_frequency: form.pruning_frequency || null,
        cycle: form.cycle || null,
        care_level: form.care_level || null,
        poisonous_to_pets: form.poisonous_to_pets,
        poisonous_to_humans: form.poisonous_to_humans,
      }).eq('id', id).select().single()
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

  async function fetchNotes() {
    setNotesLoading(true)
    // Only regular user-written notes show here. Plant Doctor diagnoses are
    // linked to their care_log entry instead and surface via Recent Activity.
    const { data, error } = await supabase
      .from('plant_notes')
      .select('*')
      .eq('plant_id', id)
      .eq('source', 'user')
      .order('created_at', { ascending: false })
    if (!error) setNotes(data)
    setNotesLoading(false)
  }

  async function handleAddNote() {
    const content = newNoteText.trim()
    if (!content) return
    setSavingNote(true); setNoteError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('plant_notes')
        .insert({ plant_id: id, user_id: user.id, content })
        .select()
        .single()
      if (error) throw error
      setNotes((prev) => [data, ...prev])
      setNewNoteText('')
      setAddingNote(false)
    } catch (err) {
      setNoteError('Could not save that note. Please try again.')
    } finally {
      setSavingNote(false)
    }
  }

  function startEditNote(note) {
    setEditingNoteId(note.id)
    setEditNoteText(note.content)
  }

  async function handleSaveEditNote(noteId) {
    const content = editNoteText.trim()
    if (!content) return
    setSavingEditNote(true)
    try {
      const { data, error } = await supabase
        .from('plant_notes')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', noteId)
        .select()
        .single()
      if (error) throw error
      setNotes((prev) => prev.map((n) => (n.id === noteId ? data : n)))
      setEditingNoteId(null)
    } catch (err) {
      // keep the editor open so they can retry
    } finally {
      setSavingEditNote(false)
    }
  }

  async function handleDeleteNote(noteId) {
    try {
      const { error } = await supabase.from('plant_notes').delete().eq('id', noteId)
      if (error) throw error
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch (err) {
      // silently ignore; note stays in the list if delete failed
    }
  }

  // ---- Renders one reminder card (Water or Custom) ----
  function renderReminderCard(careType, title) {
    const rem = reminders[careType] || {}
    const enabled = Boolean(rem.enabled)
    const hour = rem.time_hour ?? 8
    const days = rem.frequency_days ?? null
    const isCustomHour = hour !== 8 && hour !== 18
    const showCustomPicker = customOpen[careType] || isCustomHour
    const saving = reminderSaving[careType]
    const noSuggestionAvailable = careType === 'water' && !plant.watering

    return (
      <div className="plantdetail-reminder-card">
        <div className="plantdetail-reminder-row">
          <div className="plantdetail-reminder-label">
            {enabled ? <IconBell size={18} /> : <IconBellOff size={18} />}
            <span>{title} · {enabled ? 'on' : 'off'}</span>
          </div>
          <button
            className={`plantdetail-reminder-toggle ${enabled ? 'is-on' : ''}`}
            onClick={() => handleToggleReminder(careType)}
            disabled={saving}
          >
            <span className="plantdetail-reminder-toggle-knob" />
          </button>
        </div>
        {enabled && (
          <>
            <div className="plantdetail-reminder-divider" />
            <p className="plantdetail-reminder-sublabel">Remind me · {formatHour(hour)}</p>
            <div className="plantdetail-reminder-time-btns">
              <button
                className={`plantdetail-reminder-time-btn ${hour === 8 ? 'is-selected' : ''}`}
                onClick={() => { handleReminderTime(careType, 8); setCustomOpen((prev) => ({ ...prev, [careType]: false })) }}
              >
                🌅 Morning
                <span className="plantdetail-reminder-time-sub">8:00 AM</span>
              </button>
              <button
                className={`plantdetail-reminder-time-btn ${hour === 18 ? 'is-selected' : ''}`}
                onClick={() => { handleReminderTime(careType, 18); setCustomOpen((prev) => ({ ...prev, [careType]: false })) }}
              >
                🌆 Evening
                <span className="plantdetail-reminder-time-sub">6:00 PM</span>
              </button>
              <button
                className={`plantdetail-reminder-time-btn ${showCustomPicker ? 'is-selected' : ''}`}
                onClick={() => setCustomOpen((prev) => ({ ...prev, [careType]: true }))}
              >
                ⏰ Custom
                <span className="plantdetail-reminder-time-sub">{isCustomHour ? formatHour(hour) : 'Pick time'}</span>
              </button>
            </div>

            {showCustomPicker && (
              <select
                className="plantdetail-hour-select"
                value={hour}
                onChange={(e) => handleReminderTime(careType, Number(e.target.value))}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{formatHour(h)}</option>
                ))}
              </select>
            )}

            <p className="plantdetail-reminder-sublabel" style={{ marginTop: 12 }}>
              {days == null ? 'Choose how often' : 'Every'}
            </p>
            {days == null && noSuggestionAvailable && (
              <p className="plantdetail-reminder-hint">No plant data to suggest a frequency — pick one below.</p>
            )}
            <div className="plantdetail-reminder-freq-btns">
              {[1, 2, 3, 5, 7, 14].map((d) => (
                <button
                  key={d}
                  className={`plantdetail-reminder-freq-btn ${days === d ? 'is-selected' : ''}`}
                  onClick={() => handleReminderFrequency(careType, d)}
                >
                  {d === 1 ? 'day' : `${d}d`}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
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
          <p className="plantdetail-form-section-title">Basic info</p>
          <label>Nickname *<input type="text" value={form.nickname} onChange={(e) => updateField('nickname', e.target.value)} required /></label>
          <label>Common name<input type="text" value={form.common_name} onChange={(e) => updateField('common_name', e.target.value)} /></label>
          <label>Scientific name<input type="text" value={form.scientific_name} onChange={(e) => updateField('scientific_name', e.target.value)} /></label>

          <p className="plantdetail-form-section-title">Plant passport</p>
          <label>💧 Watering
            <select value={form.watering} onChange={(e) => updateField('watering', e.target.value)}>
              <option value="">— Not set —</option>
              {WATERING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label>☀️ Sunlight
            <select value={form.sunlight} onChange={(e) => updateField('sunlight', e.target.value)}>
              <option value="">— Not set —</option>
              {SUNLIGHT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label>🌱 Soil type
            <select value={form.soil_type} onChange={(e) => updateField('soil_type', e.target.value)}>
              <option value="">— Not set —</option>
              {SOIL_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label>💨 Humidity
            <select value={form.humidity} onChange={(e) => updateField('humidity', e.target.value)}>
              <option value="">— Not set —</option>
              {HUMIDITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label>pH level
            <select value={form.ph_level} onChange={(e) => updateField('ph_level', e.target.value)}>
              <option value="">— Not set —</option>
              {PH_LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          <p className="plantdetail-form-section-title">Extended profile</p>
          <div className="plantdetail-number-row">
            <label>Temp min (°C)<input type="number" value={form.temp_min} onChange={(e) => updateField('temp_min', e.target.value)} placeholder="e.g. 18" /></label>
            <label>Temp max (°C)<input type="number" value={form.temp_max} onChange={(e) => updateField('temp_max', e.target.value)} placeholder="e.g. 24" /></label>
          </div>
          <label>Fertilizer frequency
            <select value={form.fertilizer_frequency} onChange={(e) => updateField('fertilizer_frequency', e.target.value)}>
              <option value="">— Not set —</option>
              {FERTILIZER_FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label>Pruning frequency
            <select value={form.pruning_frequency} onChange={(e) => updateField('pruning_frequency', e.target.value)}>
              <option value="">— Not set —</option>
              {PRUNING_FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label>Cycle
            <select value={form.cycle} onChange={(e) => updateField('cycle', e.target.value)}>
              <option value="">— Not set —</option>
              {CYCLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label>Difficulty
            <select value={form.care_level} onChange={(e) => updateField('care_level', e.target.value)}>
              <option value="">— Not set —</option>
              {DIFFICULTY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          <p className="plantdetail-form-section-title">Toxicity</p>
          <label className="plantdetail-checkbox-row">
            <input type="checkbox" checked={form.poisonous_to_pets} onChange={(e) => updateField('poisonous_to_pets', e.target.checked)} />
            Poisonous to pets
          </label>
          <label className="plantdetail-checkbox-row">
            <input type="checkbox" checked={form.poisonous_to_humans} onChange={(e) => updateField('poisonous_to_humans', e.target.checked)} />
            Poisonous to humans
          </label>

          {saveError && <p className="plantdetail-error">{saveError}</p>}
          <button type="submit" className="plantdetail-save-btn" disabled={saving}><IconCheck size={18} />{saving ? 'Saving...' : 'Save changes'}</button>
        </form>
      </div>
    )
  }

  const lastByAction = {}
  for (const log of logs) { if (!lastByAction[log.action]) lastByAction[log.action] = log }
  const displayImage = mainPhotoUrl || plant.image_url

  const diffBadge = difficultyBadge(plant.care_level)
  const toxBadge = toxicityBadge(plant)
  const humanToxBadge = humanToxicityBadge(plant)
  const wateringFriendly = displayWatering(plant.watering)
  const sunlightFriendly = displaySunlight(plant.sunlight)
  const wateringDays = plant.watering ? defaultFrequencyDays(plant.watering) : null
  const soilFriendly = labelFor(SOIL_TYPE_OPTIONS, plant.soil_type)
  const humidityFriendly = labelFor(HUMIDITY_OPTIONS, plant.humidity)
  const phFriendly = labelFor(PH_LEVEL_OPTIONS, plant.ph_level)
  const fertilizerFriendly = labelFor(FERTILIZER_FREQUENCY_OPTIONS, plant.fertilizer_frequency)
  const pruningFriendly = labelFor(PRUNING_FREQUENCY_OPTIONS, plant.pruning_frequency)
  const hasTempRange = plant.temp_min != null || plant.temp_max != null

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

        {(diffBadge || toxBadge || humanToxBadge) && (
          <div className="plantdetail-badge-topleft">
            {diffBadge && <span className="plantdetail-badge">{diffBadge.emoji} {diffBadge.label}</span>}
            {toxBadge && <span className="plantdetail-badge">{toxBadge.emoji} {toxBadge.label}</span>}
            {humanToxBadge && <span className="plantdetail-badge">{humanToxBadge.emoji} {humanToxBadge.label}</span>}
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
          <p className="plantdetail-passport-value">{soilFriendly || '—'}</p>
        </button>
        <button className="plantdetail-passport-card" onClick={scrollToProfile}>
          <div className="plantdetail-passport-emoji">💨</div>
          <p className="plantdetail-passport-label">Humidity</p>
          <p className="plantdetail-passport-value">{humidityFriendly || '—'}</p>
        </button>
      </div>

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
              <strong>Soil type:</strong> {soilFriendly || 'Information not added yet'}
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Soil pH:</strong> {phFriendly || 'Information not added yet'}
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Humidity:</strong> {humidityFriendly || 'Information not added yet'}
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Temperature range:</strong> {hasTempRange ? `${plant.temp_min ?? '?'}–${plant.temp_max ?? '?'}°C` : 'Information not added yet'}
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Fertilizer schedule:</strong> {fertilizerFriendly || 'Information not added yet'}
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Pruning advice:</strong> {pruningFriendly || 'Information not added yet'}
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Cycle:</strong> {plant.cycle || 'Information not added yet'}
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Care level:</strong> {plant.care_level || 'Information not added yet'}
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Toxicity to pets:</strong> {toxBadge ? `${toxBadge.emoji} ${toxBadge.label}` : 'Information not added yet'}
            </div>
            <div className="plantdetail-accordion-item">
              <strong>Toxicity to humans:</strong> {humanToxBadge ? `${humanToxBadge.emoji} ${humanToxBadge.label}` : 'Not toxic to humans'}
            </div>

            <div className="plantdetail-notes-section">
              <p className="plantdetail-notes-title">📝 Notes</p>

              {addingNote ? (
                <div className="plantdetail-note-editor">
                  <textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Write a note about this plant..."
                    autoFocus
                  />
                  {noteError && <p className="plantdetail-error">{noteError}</p>}
                  <div className="plantdetail-note-editor-actions">
                    <button
                      className="plantdetail-note-save-btn"
                      onClick={handleAddNote}
                      disabled={savingNote || !newNoteText.trim()}
                    >
                      <IconCheck size={16} /> Save
                    </button>
                    <button
                      className="plantdetail-note-cancel-btn"
                      onClick={() => { setAddingNote(false); setNewNoteText(''); setNoteError(null) }}
                      disabled={savingNote}
                    >
                      <IconX size={16} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className="plantdetail-note-add-btn" onClick={() => setAddingNote(true)}>
                  <IconPlus size={16} /> Add note
                </button>
              )}

              {notesLoading ? (
                <p className="plantdetail-notes-empty">Loading notes...</p>
              ) : notes.length === 0 && !addingNote ? (
                <p className="plantdetail-notes-empty">No notes yet.</p>
              ) : (
                <div className="plantdetail-notes-list">
                  {notes.map((note) => {
                    const wasEdited = note.updated_at && note.updated_at !== note.created_at
                    const displayDate = note.updated_at || note.created_at
                    return (
                      <div key={note.id} className="plantdetail-note-card">
                        {editingNoteId === note.id ? (
                          <div className="plantdetail-note-editor">
                            <textarea
                              value={editNoteText}
                              onChange={(e) => setEditNoteText(e.target.value)}
                              autoFocus
                            />
                            <div className="plantdetail-note-editor-actions">
                              <button
                                className="plantdetail-note-save-btn"
                                onClick={() => handleSaveEditNote(note.id)}
                                disabled={savingEditNote || !editNoteText.trim()}
                              >
                                <IconCheck size={16} /> Save
                              </button>
                              <button
                                className="plantdetail-note-cancel-btn"
                                onClick={() => setEditingNoteId(null)}
                                disabled={savingEditNote}
                              >
                                <IconX size={16} /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="plantdetail-note-text">{note.content}</p>
                            <div className="plantdetail-note-footer">
                              <span className="plantdetail-note-date">
                                {formatRelativeDay(displayDate)} · {formatTime(displayDate)}
                                {wasEdited ? ' (edited)' : ''}
                              </span>
                              <div className="plantdetail-note-actions">
                                <button className="plantdetail-note-icon-btn" onClick={() => startEditNote(note)}>
                                  <IconPencil size={14} />
                                </button>
                                <button
                                  className="plantdetail-note-icon-btn plantdetail-note-icon-btn-danger"
                                  onClick={() => handleDeleteNote(note.id)}
                                >
                                  <IconTrash size={14} />
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {plant.care_guide && Object.keys(plant.care_guide).length > 0 && (
              <div className="plantdetail-careguide">
                <p className="plantdetail-careguide-title">🌿 More about this plant</p>
                {CARE_GUIDE_META.filter(({ key }) => plant.care_guide[key]).map(({ key, emoji, label }) => (
                  <div key={key} className="plantdetail-careguide-item">
                    <p className="plantdetail-careguide-heading">{emoji} {label}</p>
                    <p className="plantdetail-careguide-text">{plant.care_guide[key]}</p>
                  </div>
                ))}
              </div>
            )}
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

      <button className="plantdetail-doctor-btn" onClick={() => navigate(`/plant/${id}/doctor`)}>
        <IconStethoscope size={20} />
        Ask the Plant Doctor
      </button>

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

      {suggestionBanner.visible && (
        <div className="plantdetail-suggestion-banner">
          <p>{suggestionBanner.text}</p>
          <div className="plantdetail-suggestion-actions">
            <button className="plantdetail-suggestion-yes" onClick={handleAcceptSuggestion}>Yes, Add Reminder</button>
            <button className="plantdetail-suggestion-no" onClick={handleDismissSuggestion}>No thanks</button>
          </div>
        </div>
      )}

      <h3 className="plantdetail-section-title">Reminders</h3>
      {renderReminderCard('water', '💧 Water reminder')}
      <div style={{ height: 12 }} />
      {renderReminderCard('custom', '⏰ Custom reminder')}

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
                const isDoctor = isCustom && log.custom_action === 'Plant Doctor'
                const doctorNote = isDoctor ? doctorNotes[log.id] : null
                const meta = !isCustom ? CARE_ACTIONS.find((a) => a.key === log.action) : null
                const Icon = meta?.icon
                const isExpanded = expandedLogId === log.id
                return (
                  <div key={log.id}>
                    <div
                      className={`plantdetail-activity-row ${doctorNote ? 'is-clickable' : ''}`}
                      onClick={doctorNote ? () => setExpandedLogId(isExpanded ? null : log.id) : undefined}
                    >
                      <span className="plantdetail-activity-icon">{isDoctor ? '🩺' : isCustom ? '📌' : <Icon size={16} />}</span>
                      <span className="plantdetail-activity-label">{isCustom ? (log.custom_action || 'Other') : meta.label}</span>
                      <span className="plantdetail-activity-time">{formatRelativeDay(log.logged_at)} · {formatTime(log.logged_at)}</span>
                    </div>
                    {isExpanded && doctorNote && (
                      <div className="plantdetail-activity-detail">
                        <p className="plantdetail-activity-detail-text">{doctorNote.content}</p>
                        <button className="plantdetail-activity-detail-delete" onClick={() => handleDeleteDoctorNote(log.id)}>
                          <IconTrash size={14} /> Delete diagnosis
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}