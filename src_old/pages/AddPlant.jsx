import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconSearch, IconArrowLeft, IconPlus, IconCheck, IconCamera, IconX, IconRefresh } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { searchPlants, getPlantDetails, getCareGuide } from '../lib/perenual'
import { uploadPlantPhoto } from '../lib/photos'
import {
  WATERING_OPTIONS, SUNLIGHT_OPTIONS, SOIL_TYPE_OPTIONS, HUMIDITY_OPTIONS,
  PH_LEVEL_OPTIONS, FERTILIZER_FREQUENCY_OPTIONS, PRUNING_FREQUENCY_OPTIONS,
  CYCLE_OPTIONS, DIFFICULTY_OPTIONS,
  mapPerenualWatering, mapPerenualSunlight, mapPerenualCycle, mapPerenualPhLevel,
  mapPerenualSoil, mapPerenualPruning,
} from '../lib/plantFields'
import AchievementToast from '../components/AchievementToast'
import { checkAndUnlockAchievements, ACHIEVEMENTS } from '../lib/achievements'
import thinkingMascot    from '../assets/mascot/thinking.png'
import celebratingMascot from '../assets/mascot/celebrating.png'
import './AddPlant.css'

const EMPTY_FORM = {
  nickname: '', common_name: '', scientific_name: '',
  perenual_id: null, image_url: '', care_guide: null,
  watering: '', sunlight: '', soil_type: '', humidity: '', ph_level: '',
  temp_min: '', temp_max: '', fertilizer_frequency: '', pruning_frequency: '',
  cycle: '', care_level: '',
  poisonous_to_pets: false, poisonous_to_humans: false,
}

const WATERING_TO_DAYS = { frequent: 1, average: 3, minimum: 7, none: null, soak_and_dry: 10, bottom_water: 4 }
function defaultFrequencyDays(wateringText) {
  if (!wateringText) return null
  return WATERING_TO_DAYS[wateringText.toLowerCase().trim()] ?? null
}

// Resizes an image file down before sending it to the AI, to keep uploads
// fast and stay comfortably within free-tier request size limits.
function resizeImageToBase64(file, maxDim = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not read image'))
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxDim) {
          height = Math.round(height * (maxDim / width)); width = maxDim
        } else if (height > maxDim) {
          width = Math.round(width * (maxDim / height)); height = maxDim
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

export default function AddPlant() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [mode, setMode] = useState('search') // 'search' | 'scan' | 'form'
  const [form, setForm] = useState(EMPTY_FORM)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toastAchievement, setToastAchievement] = useState(null)
  const debounceRef = useRef(null)

  // Scan tab state
  const [scanFile, setScanFile] = useState(null)       // original file, uploaded as the real photo on save
  const [scanPreview, setScanPreview] = useState(null)  // resized data URL, shown in preview + sent to AI
  const [scanBase64, setScanBase64] = useState(null)
  const [scanIdentifying, setScanIdentifying] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [scanOrigin, setScanOrigin] = useState(false)   // true if the current form came from a scan
  const scanFileInputRef = useRef(null)

  // Reminder-suggestion popup shown right after saving
  const [showReminderPrompt, setShowReminderPrompt] = useState(false)
  const [pendingPlantId, setPendingPlantId] = useState(null)
  const [suggestedReminderDays, setSuggestedReminderDays] = useState(null)
  const [settingReminder, setSettingReminder] = useState(false)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) { setResults([]); setSearchError(null); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true); setSearchError(null)
      try { const data = await searchPlants(query); setResults(data) }
      catch (err) { setSearchError("Couldn't reach the plant database. Try again or add manually."); setResults([]) }
      finally { setSearching(false) }
    }, 500)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  function resetScanState() {
    setScanFile(null)
    setScanPreview(null)
    setScanBase64(null)
    setScanError(null)
    setScanOrigin(false)
  }

  function goToTab(tab) {
    if (tab !== 'scan') resetScanState()
    setMode(tab)
  }

  async function handleSelectResult(result) {
    setLoadingDetails(true)
    try {
      const details = await getPlantDetails(result.id)
      const careGuide = await getCareGuide(result.id)
      setForm({
        nickname: details.common_name || '',
        common_name: details.common_name || '',
        scientific_name: details.scientific_name?.[0] || '',
        perenual_id: details.id,
        image_url: details.default_image?.medium_url || details.default_image?.regular_url || '',
        watering: mapPerenualWatering(details.watering) || '',
        sunlight: mapPerenualSunlight(details.sunlight) || '',
        soil_type: mapPerenualSoil(details.soil) || '',
        humidity: '',
        ph_level: mapPerenualPhLevel(details) || '',
        temp_min: '',
        temp_max: '',
        fertilizer_frequency: '',
        pruning_frequency: mapPerenualPruning(details.pruning_count) || '',
        cycle: mapPerenualCycle(details.cycle) || '',
        care_level: details.care_level || '',
        care_guide: careGuide,
        poisonous_to_pets: Boolean(details.poisonous_to_pets),
        poisonous_to_humans: Boolean(details.poisonous_to_humans),
      })
      setScanOrigin(false)
      setMode('form')
    } catch (err) { setSearchError("Couldn't load details. Try another or add manually.") }
    finally { setLoadingDetails(false) }
  }

  function startManualEntry() {
    resetScanState()
    setForm(EMPTY_FORM)
    setMode('form')
  }

  async function handleScanFileSelected(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setScanError(null)
    try {
      const dataUrl = await resizeImageToBase64(file)
      setScanFile(file)
      setScanPreview(dataUrl)
      setScanBase64(dataUrl.split(',')[1])
    } catch (err) {
      setScanError('Could not read that photo. Please try another.')
    }
  }

  async function handleIdentify(previousGuess = null) {
    if (!scanBase64) return
    setScanIdentifying(true)
    setScanError(null)
    try {
      const { data, error } = await supabase.functions.invoke('identify-plant', {
        body: { image_base64: scanBase64, mime_type: 'image/jpeg', previous_guess: previousGuess },
      })
      if (error) throw error
      if (!data || !data.identified) {
        setScanError("Couldn't clearly identify a plant in that photo. Try a clearer, closer photo, or add it manually.")
        return
      }
      setForm({
        ...EMPTY_FORM,
        nickname: data.common_name || '',
        common_name: data.common_name || '',
        scientific_name: data.scientific_name || '',
        perenual_id: null,
        care_guide: data.care_guide || null,
        watering: data.watering || '',
        sunlight: data.sunlight || '',
        soil_type: data.soil_type || '',
        humidity: data.humidity || '',
        ph_level: data.ph_level || '',
        temp_min: data.temp_min ?? '',
        temp_max: data.temp_max ?? '',
        fertilizer_frequency: data.fertilizer_frequency || '',
        pruning_frequency: data.pruning_frequency || '',
        cycle: data.cycle || '',
        care_level: data.care_level || '',
        poisonous_to_pets: Boolean(data.poisonous_to_pets),
        poisonous_to_humans: Boolean(data.poisonous_to_humans),
      })
      setScanOrigin(true)
      setMode('form')
    } catch (err) {
      console.error('Identify error:', err)
      setScanError('Could not identify that plant. Please try again.')
    } finally {
      setScanIdentifying(false)
    }
  }

  function handleRetryIdentify() {
    const previousGuess = form.scientific_name || form.common_name || null
    handleIdentify(previousGuess)
  }

  function updateField(field, value) { setForm((prev) => ({ ...prev, [field]: value })) }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nickname.trim()) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: insertedPlant, error } = await supabase.from('plants').insert({
        user_id: user.id,
        nickname: form.nickname.trim(),
        common_name: form.common_name || null,
        scientific_name: form.scientific_name || null,
        perenual_id: form.perenual_id,
        image_url: form.image_url || null,
        care_guide: form.care_guide || null,
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
      }).select().single()
      if (error) throw error

      // If this plant came from a photo scan, save that photo as its real
      // main photo via the existing photo system (private bucket + resize).
      if (scanOrigin && scanFile) {
        try { await uploadPlantPhoto(user.id, insertedPlant.id, scanFile) }
        catch (photoErr) { console.error('Could not save scan photo:', photoErr) }
      }

      setSaving(false)

      // If we have enough info to suggest a sensible watering frequency,
      // ask before turning a reminder on rather than deciding for the user.
      const suggestedDays = defaultFrequencyDays(form.watering)
      if (suggestedDays != null) {
        setPendingPlantId(insertedPlant.id)
        setSuggestedReminderDays(suggestedDays)
        setShowReminderPrompt(true)
      } else {
        await finishSaveFlow()
      }
    } catch (err) {
      setSearchError('Could not save your plant. Please try again.')
      setSaving(false)
    }
  }

  async function finishSaveFlow() {
    const { data: { user } } = await supabase.auth.getUser()
    const unlockedKeys = await checkAndUnlockAchievements(user.id)
    const delay = unlockedKeys.length > 0 ? 3000 : 1500
    if (unlockedKeys.length > 0) {
      setToastAchievement(ACHIEVEMENTS.find((a) => a.key === unlockedKeys[0]))
    }
    setSaved(true)
    setTimeout(() => navigate('/'), delay)
  }

  async function handleReminderChoice(accept) {
    setSettingReminder(true)
    if (accept && pendingPlantId) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('plant_reminders').insert({
          plant_id: pendingPlantId,
          user_id: user.id,
          care_type: 'water',
          enabled: true,
          frequency_days: suggestedReminderDays,
          time_hour: 8,
        })
      } catch (err) {
        console.error('Could not create reminder:', err)
      }
    }
    setShowReminderPrompt(false)
    setSettingReminder(false)
    await finishSaveFlow()
  }

  if (saved) return (
    <div className="addplant-celebrate">
      <img src={celebratingMascot} alt="BloomMate celebrating" className="addplant-mascot-large" />
      <h2>{form.nickname} added! 🌱</h2>
      <AchievementToast achievement={toastAchievement} onDismiss={() => setToastAchievement(null)} />
    </div>
  )

  return (
    <div className="addplant-page">
      <div className="addplant-header">
        <button className="addplant-back" onClick={() => mode === 'form' ? goToTab('search') : navigate('/')}><IconArrowLeft size={22} /></button>
        <h1>{mode === 'form' ? 'Plant details' : 'Add a plant'}</h1>
      </div>

      {mode !== 'form' && (
        <div className="addplant-tabs">
          <button className={`addplant-tab ${mode === 'scan' ? 'is-active' : ''}`} onClick={() => goToTab('scan')}>
            📷 Scan
          </button>
          <button className={`addplant-tab ${mode === 'search' ? 'is-active' : ''}`} onClick={() => goToTab('search')}>
            🔍 Search
          </button>
          <button className="addplant-tab" onClick={startManualEntry}>
            ✏️ Manual
          </button>
        </div>
      )}

      {mode === 'scan' && (
        <div className="addplant-scan">
          {!scanPreview ? (
            <button className="addplant-scan-upload" onClick={() => scanFileInputRef.current?.click()}>
              <IconCamera size={32} />
              <span>Take or choose a photo</span>
              <span className="addplant-scan-upload-sub">The AI will identify the plant and fill in care info for you</span>
            </button>
          ) : (
            <div className="addplant-scan-preview-wrap">
              <img src={scanPreview} alt="Scanned plant" className="addplant-scan-preview" />
              <button className="addplant-scan-remove" onClick={() => { resetScanState() }}>
                <IconX size={16} /> Choose another
              </button>
            </div>
          )}
          <input
            ref={scanFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleScanFileSelected}
          />

          {scanIdentifying && (
            <div className="addplant-loading">
              <img src={thinkingMascot} alt="BloomMate thinking" className="addplant-mascot-small" />
              <p>Identifying your plant...</p>
            </div>
          )}
          {scanError && <p className="addplant-error">{scanError}</p>}

          {scanPreview && !scanIdentifying && (
            <button className="addplant-save-btn" onClick={() => handleIdentify()}>
              <IconCheck size={18} /> Identify this plant
            </button>
          )}
        </div>
      )}

      {mode === 'search' && (
        <>
          <div className="addplant-search-bar">
            <IconSearch size={20} className="addplant-search-icon" />
            <input type="text" placeholder="Search for a plant (e.g. monstera)" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          </div>
          {searching && <div className="addplant-loading"><img src={thinkingMascot} alt="BloomMate thinking" className="addplant-mascot-small" /><p>Searching...</p></div>}
          {searchError && <p className="addplant-error">{searchError}</p>}
          {!searching && results.length > 0 && (
            <div className="addplant-results">
              {results.map((r) => (
                <button key={r.id} className="addplant-result-card" onClick={() => handleSelectResult(r)}>
                  {r.default_image?.thumbnail ? <img src={r.default_image.thumbnail} alt={r.common_name} /> : <div className="addplant-result-noimg">🌿</div>}
                  <div><p className="addplant-result-name">{r.common_name}</p>{r.scientific_name?.[0] && <p className="addplant-result-sci">{r.scientific_name[0]}</p>}</div>
                </button>
              ))}
            </div>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && !searchError && <p className="addplant-empty">No matches found.</p>}
        </>
      )}

      {mode === 'form' && (
        <form className="addplant-form" onSubmit={handleSave}>
          {loadingDetails && <p>Loading plant info...</p>}
          {(scanPreview || form.image_url) && (
            <img src={scanPreview || form.image_url} alt={form.common_name} className="addplant-form-image" />
          )}
          {scanOrigin && (
            <>
              <p className="addplant-disclaimer">
                🤖 AI identification isn't always perfect — please double-check the details below before saving.
              </p>
              {scanIdentifying ? (
                <div className="addplant-loading">
                  <img src={thinkingMascot} alt="BloomMate thinking" className="addplant-mascot-small" />
                  <p>Trying again...</p>
                </div>
              ) : (
                <button type="button" className="addplant-retry-btn" onClick={handleRetryIdentify}>
                  <IconRefresh size={16} /> Not my plant? Try again
                </button>
              )}
              {scanError && <p className="addplant-error">{scanError}</p>}
            </>
          )}

          <p className="addplant-form-section-title">Basic info</p>
          <label>Nickname *<input type="text" value={form.nickname} onChange={(e) => updateField('nickname', e.target.value)} placeholder="What do you call this plant?" required /></label>
          <label>Common name<input type="text" value={form.common_name} onChange={(e) => updateField('common_name', e.target.value)} /></label>
          <label>Scientific name<input type="text" value={form.scientific_name} onChange={(e) => updateField('scientific_name', e.target.value)} /></label>

          <p className="addplant-form-section-title">Plant passport</p>
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

          <p className="addplant-form-section-title">Extended profile</p>
          <div className="addplant-number-row">
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

          <p className="addplant-form-section-title">Toxicity</p>
          <label className="addplant-checkbox-row">
            <input type="checkbox" checked={form.poisonous_to_pets} onChange={(e) => updateField('poisonous_to_pets', e.target.checked)} />
            Poisonous to pets
          </label>
          <label className="addplant-checkbox-row">
            <input type="checkbox" checked={form.poisonous_to_humans} onChange={(e) => updateField('poisonous_to_humans', e.target.checked)} />
            Poisonous to humans
          </label>

          {searchError && <p className="addplant-error">{searchError}</p>}
          <button type="submit" className="addplant-save-btn" disabled={saving}><IconCheck size={18} />{saving ? 'Saving...' : 'Save plant'}</button>
        </form>
      )}

      {showReminderPrompt && (
        <div className="addplant-modal-overlay">
          <div className="addplant-modal" onClick={(e) => e.stopPropagation()}>
            <div className="addplant-modal-header">
              <h3>💧 Set a watering reminder?</h3>
            </div>
            <p>
              Based on {form.nickname}'s needs, we suggest watering every {suggestedReminderDays} day{suggestedReminderDays === 1 ? '' : 's'}.
              Want to turn on a reminder now? You can always change it later.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="addplant-save-btn" style={{ margin: 0 }} onClick={() => handleReminderChoice(true)} disabled={settingReminder}>
                <IconCheck size={18} /> {settingReminder ? 'Saving...' : 'Yes, remind me'}
              </button>
              <button className="addplant-reminder-no-btn" onClick={() => handleReminderChoice(false)} disabled={settingReminder}>
                No thanks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}