import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconBell, IconBellOff, IconDroplet } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { subscribeToPush } from '../lib/push'
import './Reminders.css'

const WATERING_TO_DAYS = { frequent: 1, average: 3, minimum: 7, none: null, soak_and_dry: 10, bottom_water: 4 }
function defaultFrequencyDays(wateringText) {
  if (!wateringText) return null
  return WATERING_TO_DAYS[wateringText.toLowerCase().trim()] ?? null
}

function formatHour(hour) {
  const h = hour % 12 === 0 ? 12 : hour % 12
  const suffix = hour < 12 ? 'AM' : 'PM'
  return `${h}:00 ${suffix}`
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i)

export default function Reminders({ session }) {
  const navigate = useNavigate()
  const [plants, setPlants] = useState([])
  const [reminders, setReminders] = useState({}) // { [plantId]: { water: row, custom: row } }
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [pauseSaving, setPauseSaving] = useState(false)
  const [pushError, setPushError] = useState(null)
  const [customOpenKey, setCustomOpenKey] = useState(null) // `${plantId}_${careType}`

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: plantData }, { data: reminderData }, { data: settings }] = await Promise.all([
      supabase
        .from('plants')
        .select('id, nickname, image_url, watering')
        .eq('user_id', session.user.id)
        .order('nickname'),
      supabase.from('plant_reminders').select('*').eq('user_id', session.user.id),
      supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle(),
    ])
    setPlants(plantData || [])
    const grouped = {}
    ;(reminderData || []).forEach((r) => {
      if (!grouped[r.plant_id]) grouped[r.plant_id] = {}
      grouped[r.plant_id][r.care_type] = r
    })
    setReminders(grouped)
    setPaused(settings?.notifications_paused || false)
    setLoading(false)
  }

  async function handleTogglePause() {
    setPauseSaving(true)
    const newValue = !paused
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: session.user.id, notifications_paused: newValue }, { onConflict: 'user_id' })
    if (!error) setPaused(newValue)
    setPauseSaving(false)
  }

  async function ensurePushPermission() {
    try {
      await subscribeToPush(session.user.id)
      setPushError(null)
    } catch (err) {
      setPushError(err.message || 'Could not enable notifications on this device.')
    }
  }

  async function upsertReminder(plantId, careType, updates) {
    const existing = reminders[plantId]?.[careType]
    try {
      if (existing) {
        const { data, error } = await supabase
          .from('plant_reminders')
          .update(updates)
          .eq('id', existing.id)
          .select()
          .single()
        if (error) throw error
        setReminders((prev) => ({ ...prev, [plantId]: { ...prev[plantId], [careType]: data } }))
      } else {
        const { data, error } = await supabase
          .from('plant_reminders')
          .insert({ plant_id: plantId, user_id: session.user.id, care_type: careType, ...updates })
          .select()
          .single()
        if (error) throw error
        setReminders((prev) => ({ ...prev, [plantId]: { ...prev[plantId], [careType]: data } }))
      }
    } catch (err) {
      console.error('Could not save reminder:', err)
    }
  }

  async function handleToggleReminder(plant, careType) {
    const existing = reminders[plant.id]?.[careType]
    const turningOn = !existing?.enabled
    if (turningOn) await ensurePushPermission()
    let frequency = existing?.frequency_days ?? null
    if (turningOn && frequency == null && careType === 'water' && plant.watering) {
      frequency = defaultFrequencyDays(plant.watering)
    }
    await upsertReminder(plant.id, careType, {
      enabled: turningOn,
      time_hour: existing?.time_hour ?? 8,
      frequency_days: frequency,
    })
  }

  async function handleTime(plant, careType, hour) {
    await upsertReminder(plant.id, careType, { time_hour: hour })
  }

  async function handleFrequency(plant, careType, days) {
    await upsertReminder(plant.id, careType, { frequency_days: days })
  }

  function renderTypeBlock(plant, careType, label) {
    const rem = reminders[plant.id]?.[careType] || {}
    const enabled = Boolean(rem.enabled)
    const hour = rem.time_hour ?? 8
    const days = rem.frequency_days ?? null
    const isCustomHour = hour !== 8 && hour !== 18
    const key = `${plant.id}_${careType}`
    const showCustomPicker = customOpenKey === key || (enabled && isCustomHour)
    const noSuggestion = careType === 'water' && !plant.watering

    return (
      <div className="reminders-type-block">
        <div className="reminders-type-row">
          <span className="reminders-type-label">{label}</span>
          <button
            className={`reminders-toggle reminders-toggle-sm ${enabled ? 'is-on' : ''}`}
            onClick={() => handleToggleReminder(plant, careType)}
          >
            <span className="reminders-toggle-knob" />
          </button>
        </div>

        {enabled && (
          <>
            <p className="reminders-sublabel">Remind me</p>
            <div className="reminders-time-btns">
              <button
                className={`reminders-time-btn ${hour === 8 ? 'is-selected' : ''}`}
                onClick={() => { handleTime(plant, careType, 8); setCustomOpenKey(null) }}
              >
                🌅 Morning
              </button>
              <button
                className={`reminders-time-btn ${hour === 18 ? 'is-selected' : ''}`}
                onClick={() => { handleTime(plant, careType, 18); setCustomOpenKey(null) }}
              >
                🌆 Evening
              </button>
              <button
                className={`reminders-time-btn ${showCustomPicker ? 'is-selected' : ''}`}
                onClick={() => setCustomOpenKey(key)}
              >
                ⏰ Custom
              </button>
            </div>

            {showCustomPicker && (
              <select
                className="reminders-hour-select"
                value={hour}
                onChange={(e) => handleTime(plant, careType, Number(e.target.value))}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{formatHour(h)}</option>
                ))}
              </select>
            )}

            <p className="reminders-sublabel" style={{ marginTop: 12 }}>
              {days == null ? 'Choose how often' : 'Every'}
            </p>
            {days == null && noSuggestion && (
              <p className="reminders-hint">No plant data to suggest a frequency — pick one below.</p>
            )}
            <div className="reminders-freq-btns">
              {[1, 2, 3, 5, 7, 14].map((d) => (
                <button
                  key={d}
                  className={`reminders-freq-btn ${days === d ? 'is-selected' : ''}`}
                  onClick={() => handleFrequency(plant, careType, d)}
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

  return (
    <div className="page">
      <header className="app-header">
        <button className="reminders-back" onClick={() => navigate(-1)}><IconArrowLeft size={22} /></button>
        <h2>Reminders</h2>
      </header>

      <main className="content">
        <div className="reminders-pause-card">
          <div className="reminders-pause-row">
            <div className="reminders-pause-label">
              {paused ? <IconBellOff size={22} /> : <IconBell size={22} />}
              <div>
                <p className="reminders-pause-title">Pause all reminders</p>
                <p className="reminders-pause-sub">{paused ? 'No reminders will be sent' : 'Reminders are active'}</p>
              </div>
            </div>
            <button className={`reminders-toggle ${!paused ? 'is-on' : ''}`} onClick={handleTogglePause} disabled={pauseSaving}>
              <span className="reminders-toggle-knob" />
            </button>
          </div>
        </div>

        {pushError && <p className="reminders-error">{pushError}</p>}

        {loading ? (
          <p className="reminders-empty">Loading...</p>
        ) : plants.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🔔</div>
            <h3>No plants yet</h3>
            <p>Add a plant to set up watering reminders</p>
          </div>
        ) : (
          <div className="reminders-plant-list">
            {plants.map((plant) => (
              <div key={plant.id} className="reminders-plant-card">
                <div className="reminders-plant-header">
                  {plant.image_url
                    ? <img src={plant.image_url} alt={plant.nickname} className="reminders-plant-img" />
                    : <div className="reminders-plant-noimg"><IconDroplet size={18} /></div>}
                  <span className="reminders-plant-name">{plant.nickname}</span>
                </div>

                {renderTypeBlock(plant, 'water', '💧 Water')}
                <div className="reminders-type-divider" />
                {renderTypeBlock(plant, 'custom', '⏰ Custom')}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}