import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconSearch, IconArrowLeft, IconPlus, IconCheck } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { searchPlants, getPlantDetails } from '../lib/perenual'
import {
  WATERING_OPTIONS, SUNLIGHT_OPTIONS, SOIL_TYPE_OPTIONS, HUMIDITY_OPTIONS,
  PH_LEVEL_OPTIONS, FERTILIZER_FREQUENCY_OPTIONS, PRUNING_FREQUENCY_OPTIONS,
  CYCLE_OPTIONS, DIFFICULTY_OPTIONS,
  mapPerenualWatering, mapPerenualSunlight, mapPerenualCycle, mapPerenualPhLevel,
} from '../lib/plantFields'
import AchievementToast from '../components/AchievementToast'
import { checkAndUnlockAchievements, ACHIEVEMENTS } from '../lib/achievements'
import thinkingMascot    from '../assets/mascot/thinking.png'
import celebratingMascot from '../assets/mascot/celebrating.png'
import './AddPlant.css'

const EMPTY_FORM = {
  nickname: '', common_name: '', scientific_name: '',
  perenual_id: null, image_url: '',
  watering: '', sunlight: '', soil_type: '', humidity: '', ph_level: '',
  temp_min: '', temp_max: '', fertilizer_frequency: '', pruning_frequency: '',
  cycle: '', care_level: '',
  poisonous_to_pets: false, poisonous_to_humans: false,
}

export default function AddPlant() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [mode, setMode] = useState('search')
  const [form, setForm] = useState(EMPTY_FORM)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toastAchievement, setToastAchievement] = useState(null)
  const debounceRef = useRef(null)

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

  async function handleSelectResult(result) {
    setLoadingDetails(true)
    try {
      const details = await getPlantDetails(result.id)
      setForm({
        nickname: details.common_name || '',
        common_name: details.common_name || '',
        scientific_name: details.scientific_name?.[0] || '',
        perenual_id: details.id,
        image_url: details.default_image?.medium_url || details.default_image?.regular_url || '',
        watering: mapPerenualWatering(details.watering) || '',
        sunlight: mapPerenualSunlight(details.sunlight) || '',
        soil_type: '',
        humidity: '',
        ph_level: mapPerenualPhLevel(details) || '',
        temp_min: '',
        temp_max: '',
        fertilizer_frequency: '',
        pruning_frequency: '',
        cycle: mapPerenualCycle(details.cycle) || '',
        care_level: details.care_level || '',
        poisonous_to_pets: Boolean(details.poisonous_to_pets),
        poisonous_to_humans: Boolean(details.poisonous_to_humans),
      })
      setMode('form')
    } catch (err) { setSearchError("Couldn't load details. Try another or add manually.") }
    finally { setLoadingDetails(false) }
  }

  function startManualEntry() {
    setForm(EMPTY_FORM)
    setMode('form')
  }

  function updateField(field, value) { setForm((prev) => ({ ...prev, [field]: value })) }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.nickname.trim()) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('plants').insert({
        user_id: user.id,
        nickname: form.nickname.trim(),
        common_name: form.common_name || null,
        scientific_name: form.scientific_name || null,
        perenual_id: form.perenual_id,
        image_url: form.image_url || null,
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
      })
      if (error) throw error
      const unlockedKeys = await checkAndUnlockAchievements(user.id)
      const delay = unlockedKeys.length > 0 ? 3000 : 1500
      if (unlockedKeys.length > 0) {
        setToastAchievement(ACHIEVEMENTS.find((a) => a.key === unlockedKeys[0]))
      }
      setSaved(true)
      setTimeout(() => navigate('/'), delay)
    } catch (err) {
      setSearchError('Could not save your plant. Please try again.')
      setSaving(false)
    }
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
        <button className="addplant-back" onClick={() => mode === 'form' ? setMode('search') : navigate('/')}><IconArrowLeft size={22} /></button>
        <h1>{mode === 'search' ? 'Add a plant' : 'Plant details'}</h1>
      </div>
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
          <button className="addplant-manual-btn" onClick={startManualEntry}><IconPlus size={18} />Can't find it? Add manually</button>
        </>
      )}
      {mode === 'form' && (
        <form className="addplant-form" onSubmit={handleSave}>
          {loadingDetails && <p>Loading plant info...</p>}
          {form.image_url && <img src={form.image_url} alt={form.common_name} className="addplant-form-image" />}

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
    </div>
  )
}