import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconStethoscope, IconCamera, IconX, IconCheck } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { getLocalDateString } from '../lib/dateUtils'
import thinkingMascot from '../assets/mascot/thinking.png'
import './PlantDoctor.css'

const SEVERITY_META = {
  healthy: { emoji: '🟢', label: 'Looks healthy' },
  mild: { emoji: '🟡', label: 'Mild concern' },
  moderate: { emoji: '🟠', label: 'Moderate concern' },
  urgent: { emoji: '🔴', label: 'Needs attention' },
  unknown: { emoji: '⚪', label: 'Unclear' },
}

// Resizes an image file before sending it to the AI, to keep uploads fast
// and stay comfortably within free-tier request size limits.
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

function formatNoteContent(d) {
  const severityLabel = SEVERITY_META[d.severity]?.label || 'Diagnosis'
  let text = `🩺 Plant Doctor — ${severityLabel}\n\n${d.diagnosis}`
  if (d.likely_causes?.length) {
    text += `\n\nLikely causes:\n` + d.likely_causes.map((c) => `• ${c}`).join('\n')
  }
  if (d.recommended_actions?.length) {
    text += `\n\nRecommended actions:\n` + d.recommended_actions.map((a) => `• ${a}`).join('\n')
  }
  return text
}

export default function PlantDoctor() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [plant, setPlant] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoBase64, setPhotoBase64] = useState(null)
  const [description, setDescription] = useState('')
  const fileInputRef = useRef(null)

  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState(null)
  const [result, setResult] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { loadPlant(); loadLogs() }, [id])

  async function loadPlant() {
    setLoading(true)
    const { data, error } = await supabase.from('plants').select('*').eq('id', id).single()
    if (!error) setPlant(data)
    setLoading(false)
  }

  async function loadLogs() {
    const { data, error } = await supabase
      .from('care_logs')
      .select('action, custom_action, logged_at')
      .eq('plant_id', id)
      .order('logged_at', { ascending: false })
      .limit(15)
    if (!error) setRecentLogs(data)
  }

  async function handlePhotoSelected(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      const dataUrl = await resizeImageToBase64(file)
      setPhotoPreview(dataUrl)
      setPhotoBase64(dataUrl.split(',')[1])
    } catch (err) {
      setAskError('Could not read that photo. Please try another.')
    }
  }

  function removePhoto() {
    setPhotoPreview(null)
    setPhotoBase64(null)
  }

  async function saveAsNoteAndLog(diagnosis) {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Log the care action first so we have its id to link the note to.
      const { data: logData, error: logError } = await supabase
        .from('care_logs')
        .insert({ plant_id: id, user_id: user.id, action: 'custom', custom_action: 'Plant Doctor' })
        .select()
        .single()
      if (logError) throw logError

      // Save the full diagnosis as a note linked to that log entry, tagged
      // as a plant_doctor note so it can be shown via Activity/History
      // instead of the regular user Notes list.
      const noteContent = formatNoteContent(diagnosis)
      await supabase.from('plant_notes').insert({
        plant_id: id,
        user_id: user.id,
        content: noteContent,
        source: 'plant_doctor',
        care_log_id: logData.id,
      })

      const { error: streakError } = await supabase.rpc('bump_streak', { p_today: getLocalDateString() })
      if (streakError) console.error('Streak update failed:', streakError)
      setSaved(true)
    } catch (err) {
      console.error('Could not save diagnosis:', err)
    }
  }

  async function handleAsk() {
    if (!photoBase64 && !description.trim()) return
    setAsking(true); setAskError(null); setResult(null); setSaved(false)
    try {
      const { data, error } = await supabase.functions.invoke('plant-doctor', {
        body: {
          plant: {
            nickname: plant.nickname,
            common_name: plant.common_name,
            scientific_name: plant.scientific_name,
            watering: plant.watering,
            sunlight: plant.sunlight,
            soil_type: plant.soil_type,
            humidity: plant.humidity,
            care_level: plant.care_level,
          },
          recent_logs: recentLogs,
          photo_base64: photoBase64,
          mime_type: photoBase64 ? 'image/jpeg' : null,
          description: description.trim() || null,
        },
      })
      if (error) throw error
      setResult(data)
      await saveAsNoteAndLog(data)
    } catch (err) {
      console.error('Plant doctor error:', err)
      setAskError('Could not get a diagnosis. Please try again.')
    } finally {
      setAsking(false)
    }
  }

  function askAnother() {
    setResult(null)
    setSaved(false)
    setAskError(null)
    setDescription('')
    removePhoto()
  }

  if (loading) {
    return (
      <div className="doctor-page">
        <div className="doctor-header">
          <button className="doctor-back" onClick={() => navigate(-1)}><IconArrowLeft size={22} /></button>
          <h1>Plant Doctor</h1>
        </div>
        <p className="doctor-loading">Loading...</p>
      </div>
    )
  }

  if (!plant) return null

  return (
    <div className="doctor-page">
      <div className="doctor-header">
        <button className="doctor-back" onClick={() => navigate(-1)}><IconArrowLeft size={22} /></button>
        <h1>Plant Doctor</h1>
      </div>

      {!result && (
        <>
          <div className="doctor-intro">
            <IconStethoscope size={22} />
            <p>I'll use {plant.nickname}'s info and recent care history to help figure out what's going on. Add a photo, a description, or both.</p>
          </div>

          <div className="doctor-photo-section">
            {!photoPreview ? (
              <button className="doctor-photo-upload" onClick={() => fileInputRef.current?.click()}>
                <IconCamera size={26} />
                <span>Add a photo (optional)</span>
              </button>
            ) : (
              <div className="doctor-photo-preview-wrap">
                <img src={photoPreview} alt="Plant symptom" className="doctor-photo-preview" />
                <button className="doctor-photo-remove" onClick={removePhoto}>
                  <IconX size={16} /> Remove photo
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoSelected}
            />
          </div>

          <label className="doctor-description-label">
            Describe what you're seeing (optional)
            <textarea
              className="doctor-description-input"
              placeholder="e.g. yellow leaves near the bottom, drooping stems, brown spots..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          {askError && <p className="doctor-error">{askError}</p>}

          {asking ? (
            <div className="doctor-loading-row">
              <img src={thinkingMascot} alt="BloomMate thinking" className="doctor-mascot-small" />
              <p>Examining {plant.nickname}...</p>
            </div>
          ) : (
            <button
              className="doctor-ask-btn"
              onClick={handleAsk}
              disabled={!photoBase64 && !description.trim()}
            >
              <IconStethoscope size={18} /> Ask the Doctor
            </button>
          )}
        </>
      )}

      {result && (
        <div className="doctor-result">
          <div className={`doctor-severity-badge severity-${result.severity}`}>
            {SEVERITY_META[result.severity]?.emoji || '⚪'} {SEVERITY_META[result.severity]?.label || 'Diagnosis'}
          </div>

          <p className="doctor-diagnosis-text">{result.diagnosis}</p>

          <p className="doctor-disclaimer">
            🤖 AI guidance isn't always accurate — for serious or ongoing issues, consider checking with a local nursery or plant expert.
          </p>

          {result.likely_causes?.length > 0 && (
            <div className="doctor-result-section">
              <p className="doctor-result-heading">Likely causes</p>
              <ul className="doctor-result-list">
                {result.likely_causes.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {result.recommended_actions?.length > 0 && (
            <div className="doctor-result-section">
              <p className="doctor-result-heading">Recommended actions</p>
              <ul className="doctor-result-list">
                {result.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          {saved && (
            <p className="doctor-saved-msg"><IconCheck size={16} /> Saved to {plant.nickname}'s Recent Activity &amp; History</p>
          )}

          <button className="doctor-ask-btn" onClick={askAnother}>Ask another question</button>
        </div>
      )}
    </div>
  )
}