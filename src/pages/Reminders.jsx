import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconBell, IconBellOff, IconDroplet } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { subscribeToPush } from '../lib/push'
import './Reminders.css'

const WATERING_TO_DAYS = { frequent: 1, average: 3, minimum: 7, none: null }
function defaultFrequencyDays(wateringText) {
  if (!wateringText) return 3
  return WATERING_TO_DAYS[wateringText.toLowerCase().trim()] ?? 3
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
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [pauseSaving, setPauseSaving] = useState(false)
  const [pushError, setPushError] = useState(null)
  const [customOpenId, setCustomOpenId] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: plantData }, { data: settings }] = await Promise.all([
      supabase
        .from('plants')
        .select('id, nickname, image_url, watering, reminder_enabled, reminder_frequency_days, reminder_time_hour')
        .eq('user_id', session.user.id)
        .order('nickname'),
      supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle(),
    ])
    setPlants(plantData || [])
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

  async function handleToggleReminder(plant) {
    const turningOn = !plant.reminder_enabled
    if (turningOn) await ensurePushPermission()
    const updates = {
      reminder_enabled: turningOn,
      reminder_frequency_days: plant.reminder_frequency_days ?? defaultFrequencyDays(plant.watering),
      reminder_time_hour: plant.reminder_time_hour ?? 8,
    }
    const { data, error } = await supabase.from('plants').update(updates).eq('id', plant.id).select().single()
    if (!error) setPlants((prev) => prev.map((p) => (p.id === plant.id ? data : p)))
  }

  async function handleTime(plant, hour) {
    const { data, error } = await supabase.from('plants').update({ reminder_time_hour: hour }).eq('id', plant.id).select().single()
    if (!error) setPlants((prev) => prev.map((p) => (p.id === plant.id ? data : p)))
  }

  async function handleFrequency(plant, days) {
    const { data, error } = await supabase.from('plants').update({ reminder_frequency_days: days }).eq('id', plant.id).select().single()
    if (!error) setPlants((prev) => prev.map((p) => (p.id === plant.id ? data : p)))
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
            {plants.map((plant) => {
              const reminderHour = plant.reminder_time_hour ?? 8
              const reminderDays = plant.reminder_frequency_days ?? defaultFrequencyDays(plant.watering)
              const isCustomHour = reminderHour !== 8 && reminderHour !== 18
              const showCustomPicker = customOpenId === plant.id || (plant.reminder_enabled && isCustomHour)

              return (
                <div key={plant.id} className="reminders-plant-card">
                  <div className="reminders-plant-header">
                    {plant.image_url
                      ? <img src={plant.image_url} alt={plant.nickname} className="reminders-plant-img" />
                      : <div className="reminders-plant-noimg"><IconDroplet size={18} /></div>}
                    <span className="reminders-plant-name">{plant.nickname}</span>
                    <button
                      className={`reminders-toggle reminders-toggle-sm ${plant.reminder_enabled ? 'is-on' : ''}`}
                      onClick={() => handleToggleReminder(plant)}
                    >
                      <span className="reminders-toggle-knob" />
                    </button>
                  </div>

                  {plant.reminder_enabled && (
                    <>
                      <p className="reminders-sublabel">Remind me</p>
                      <div className="reminders-time-btns">
                        <button className={`reminders-time-btn ${reminderHour === 8 ? 'is-selected' : ''}`} onClick={() => { handleTime(plant, 8); setCustomOpenId(null) }}>🌅 Morning</button>
                        <button className={`reminders-time-btn ${reminderHour === 18 ? 'is-selected' : ''}`} onClick={() => { handleTime(plant, 18); setCustomOpenId(null) }}>🌆 Evening</button>
                        <button className={`reminders-time-btn ${showCustomPicker ? 'is-selected' : ''}`} onClick={() => setCustomOpenId(plant.id)}>⏰ Custom</button>
                      </div>

                      {showCustomPicker && (
                        <select
                          className="reminders-hour-select"
                          value={reminderHour}
                          onChange={(e) => handleTime(plant, Number(e.target.value))}
                        >
                          {HOUR_OPTIONS.map((h) => (
                            <option key={h} value={h}>{formatHour(h)}</option>
                          ))}
                        </select>
                      )}

                      <p className="reminders-sublabel" style={{ marginTop: 12 }}>Every</p>
                      <div className="reminders-freq-btns">
                        {[1, 2, 3, 5, 7, 14].map((d) => (
                          <button key={d} className={`reminders-freq-btn ${reminderDays === d ? 'is-selected' : ''}`} onClick={() => handleFrequency(plant, d)}>
                            {d === 1 ? 'day' : `${d}d`}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}