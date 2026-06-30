import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  IconArrowLeft, IconDroplet, IconSun, IconRefresh, IconGauge,
  IconPencil, IconTrash, IconCheck, IconX, IconLeaf, IconScissors,
  IconChevronRight, IconBell, IconBellOff, IconCamera
} from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { formatRelativeDay, formatTime, isToday, getLocalDateString } from '../lib/dateUtils'
import { uploadPlantPhoto, getMainPhoto, getSignedUrl } from '../lib/photos'
import { checkAndUnlockAchievements } from '../lib/achievements'
import sadMascot from '../assets/mascot/sad.png'
import './PlantDetail.css'

const CARE_ACTIONS = [
  { key: 'water', label: 'Water', icon: IconDroplet },
  { key: 'fertilize', label: 'Fertilize', icon: IconLeaf },
  { key: 'cut', label: 'Cut', icon: IconScissors },
]

const WATERING_TO_DAYS = { 'frequent': 1, 'average': 3, 'minimum': 7, 'none': null }
function defaultFrequencyDays(wateringText) {
  if (!wateringText) return 3
  return WATERING_TO_DAYS[wateringText.toLowerCase().trim()] ?? 3
}

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
  const displayImage = mainPhotoUrl || plant.image_url

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
        {displayImage ? <img src={displayImage} alt={plant.nickname} className="plantdetail-image" /> : <div className="plantdetail-noimg">🌿</div>}
        <button className="plantdetail-photo-btn" onClick={handlePhotoButtonClick} disabled={photoUploading}>
          <IconCamera size={16} />{photoUploading ? 'Uploading...' : 'Add photo'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelected} />
      </div>
      {photoMessage && <p className="plantdetail-photo-message">{photoMessage}</p>}

      {(plant.common_name || plant.scientific_name) && (
        <div className="plantdetail-names">
          {plant.common_name && <p className="plantdetail-common">{plant.common_name}</p>}
          {plant.scientific_name && <p className="plantdetail-sci">{plant.scientific_name}</p>}
        </div>
      )}

      <div className="plantdetail-care-grid">
        {plant.watering && <div className="plantdetail-care-card"><IconDroplet size={22} className="plantdetail-care-icon" /><p className="plantdetail-care-label">Watering</p><p className="plantdetail-care-value">{plant.watering}</p></div>}
        {plant.sunlight && <div className="plantdetail-care-card"><IconSun size={22} className="plantdetail-care-icon" /><p className="plantdetail-care-label">Sunlight</p><p className="plantdetail-care-value">{plant.sunlight}</p></div>}
        {plant.cycle && <div className="plantdetail-care-card"><IconRefresh size={22} className="plantdetail-care-icon" /><p className="plantdetail-care-label">Cycle</p><p className="plantdetail-care-value">{plant.cycle}</p></div>}
        {plant.care_level && <div className="plantdetail-care-card"><IconGauge size={22} className="plantdetail-care-icon" /><p className="plantdetail-care-label">Care level</p><p className="plantdetail-care-value">{plant.care_level}</p></div>}
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
      </div>
      {logError && <p className="plantdetail-error">{logError}</p>}

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
            <p className="plantdetail-reminder-sublabel">Remind me</p>
            <div className="plantdetail-reminder-time-btns">
              <button className={`plantdetail-reminder-time-btn ${reminderHour === 8 ? 'is-selected' : ''}`} onClick={() => handleReminderTime(8)}>🌅 Morning</button>
              <button className={`plantdetail-reminder-time-btn ${reminderHour === 18 ? 'is-selected' : ''}`} onClick={() => handleReminderTime(18)}>🌆 Evening</button>
            </div>
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
                const meta = CARE_ACTIONS.find((a) => a.key === log.action)
                const Icon = meta.icon
                return (
                  <div key={log.id} className="plantdetail-activity-row">
                    <span className="plantdetail-activity-icon"><Icon size={16} /></span>
                    <span className="plantdetail-activity-label">{meta.label}</span>
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