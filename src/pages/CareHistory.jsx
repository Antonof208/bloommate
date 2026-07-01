import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconDroplet, IconLeaf, IconScissors, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { formatRelativeDay, formatTime } from '../lib/dateUtils'
import { listPlantPhotos, setMainPhoto, deletePlantPhoto, getSignedUrls } from '../lib/photos'
import './CareHistory.css'
import PhotoLightbox from '../components/PhotoLightbox'

const ACTION_META = {
  water: { label: 'Watered', icon: IconDroplet },
  fertilize: { label: 'Fertilized', icon: IconLeaf },
  cut: { label: 'Cut / pruned', icon: IconScissors },
}

export default function CareHistory() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [plantName, setPlantName] = useState('')
  const [logs, setLogs] = useState([])
  const [photos, setPhotos] = useState([])
  const [photoUrls, setPhotoUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [busyPhotoId, setBusyPhotoId] = useState(null)
  const [lightboxSrc, setLightboxSrc] = useState(null)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true); setError(null)
    try {
      const [{ data: plant, error: plantError }, { data: logData, error: logsError }, photoData] = await Promise.all([
        supabase.from('plants').select('nickname').eq('id', id).single(),
        supabase.from('care_logs').select('*').eq('plant_id', id).order('logged_at', { ascending: false }),
        listPlantPhotos(id),
      ])
      if (plantError || logsError) throw plantError || logsError
      setPlantName(plant.nickname)
      setLogs(logData)
      setPhotos(photoData)
      if (photoData.length > 0) {
        const urls = await getSignedUrls(photoData.map((p) => p.storage_path))
        setPhotoUrls(urls)
      }
    } catch (err) {
      setError('Could not load history.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetMain(photoId) {
    setBusyPhotoId(photoId)
    try {
      await setMainPhoto(id, photoId)
      setPhotos((prev) => prev.map((p) => ({ ...p, is_main: p.id === photoId })))
    } catch (err) {
      console.error(err)
    } finally {
      setBusyPhotoId(null)
    }
  }

  async function handleDeletePhoto(photo) {
    setBusyPhotoId(photo.id)
    try {
      await deletePlantPhoto(photo)
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    } catch (err) {
      console.error(err)
    } finally {
      setBusyPhotoId(null)
      setConfirmingDeleteId(null)
    }
  }

  const mainPhotoId = photos.find((p) => p.is_main)?.id ?? photos[0]?.id

  const events = [
    ...logs.map((l) => ({ type: 'log', timestamp: l.logged_at, data: l })),
    ...photos.map((p) => ({ type: 'photo', timestamp: p.created_at, data: p })),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  const groups = []
  for (const ev of events) {
    const dayLabel = formatRelativeDay(ev.timestamp)
    let group = groups.find((g) => g.label === dayLabel)
    if (!group) { group = { label: dayLabel, items: [] }; groups.push(group) }
    group.items.push(ev)
  }

  return (
    <div className="careh-page">
      <div className="careh-header">
        <button className="careh-back" onClick={() => navigate(`/plant/${id}`)}><IconArrowLeft size={22} /></button>
        <h1>{plantName ? `${plantName}'s history` : 'History'}</h1>
      </div>
      {loading ? <p className="careh-empty">Loading...</p>
        : error ? <p className="careh-empty">{error}</p>
        : events.length === 0 ? <p className="careh-empty">No activity logged yet.</p>
        : groups.map((group) => (
          <div key={group.label} className="careh-group">
            <p className="careh-group-label">{group.label}</p>
            {group.items.map((ev) => {
              if (ev.type === 'log') {
                const log = ev.data
                const meta = ACTION_META[log.action]
                const Icon = meta.icon
                return (
                  <div key={log.id} className="careh-row">
                    <div className="careh-row-icon"><Icon size={18} /></div>
                    <span className="careh-row-label">{meta.label}</span>
                    <span className="careh-row-time">{formatTime(log.logged_at)}</span>
                  </div>
                )
              }
              const photo = ev.data
              const isMain = photo.id === mainPhotoId
              const isBusy = busyPhotoId === photo.id
              const isConfirming = confirmingDeleteId === photo.id
              return (
                <div key={photo.id} className="careh-photo-card">
                  <img
                    src={photoUrls[photo.storage_path]}
                    alt="Plant photo"
                    className="careh-photo-img"
                    onClick={() => setLightboxSrc(photoUrls[photo.storage_path])}
                    style={{ cursor: 'zoom-in' }}
                  />
                  <div className="careh-photo-info">
                    <div className="careh-photo-toprow">
                      {isMain && <span className="careh-photo-badge"><IconStarFilled size={12} />Main</span>}
                      <span className="careh-photo-time">{formatTime(photo.created_at)}</span>
                    </div>
                    {isConfirming ? (
                      <div className="careh-photo-confirm">
                        <span>Delete this photo?</span>
                        <button onClick={() => handleDeletePhoto(photo)} disabled={isBusy} className="careh-photo-confirm-yes">{isBusy ? '...' : 'Yes'}</button>
                        <button onClick={() => setConfirmingDeleteId(null)} disabled={isBusy} className="careh-photo-confirm-no">No</button>
                      </div>
                    ) : (
                      <div className="careh-photo-actions">
                        {!isMain && (
                          <button className="careh-photo-action-btn" onClick={() => handleSetMain(photo.id)} disabled={isBusy}>
                            <IconStar size={14} />Set as main
                          </button>
                        )}
                        <button className="careh-photo-action-btn careh-photo-action-danger" onClick={() => setConfirmingDeleteId(photo.id)} disabled={isBusy}>
                          <IconTrash size={14} />Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {lightboxSrc && <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
          </div>
        ))}
    </div>
  )
}