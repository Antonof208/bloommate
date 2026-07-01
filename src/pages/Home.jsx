import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBell, IconBellRinging, IconFlame, IconSnowflake } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { registerServiceWorker, subscribeToPush, isSubscribed } from '../lib/push'
import { getMainPhotosForPlants } from '../lib/photos'
import BottomNav from '../components/BottomNav'
import './Home.css'

export default function Home({ session }) {
  const navigate = useNavigate()
  const [plants, setPlants] = useState([])
  const [photoUrls, setPhotoUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [streak, setStreak] = useState(null)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMessage, setPushMessage] = useState(null)
  const name = session.user.email.split('@')[0]

  useEffect(() => {
    fetchPlants()
    fetchStreak()
    registerServiceWorker()
    isSubscribed().then(setPushEnabled)
  }, [])

  async function fetchPlants() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('plants').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
    if (error) {
      setError('Could not load your plants.')
    } else {
      setPlants(data)
      try {
        const urls = await getMainPhotosForPlants(data.map((p) => p.id))
        setPhotoUrls(urls)
      } catch (err) {
        console.error('Could not load plant photos:', err)
      }
    }
    setLoading(false)
  }

  async function fetchStreak() {
    const { data } = await supabase.from('user_streaks').select('*').eq('user_id', session.user.id).maybeSingle()
    setStreak(data)
  }

  async function handleBellClick() {
    if (pushEnabled) {
      setPushMessage('Reminders are already on for this browser 🔔')
      setTimeout(() => setPushMessage(null), 3000)
      return
    }
    setPushBusy(true)
    setPushMessage(null)
    try {
      await subscribeToPush(session.user.id)
      setPushEnabled(true)
      setPushMessage('Notifications enabled! 🎉')
    } catch (err) {
      setPushMessage(err.message || 'Could not enable notifications.')
    } finally {
      setPushBusy(false)
      setTimeout(() => setPushMessage(null), 4000)
    }
  }

  const currentStreak = streak?.current_streak || 0

  return (
    <div className="page">
      <header className="app-header">
        <div>
          <p className="header-greeting">Hey {name} 👋</p>
          <h2>My Plants 🌿</h2>
        </div>
        <div className="home-header-right">
          <div className={`streak-badge ${currentStreak === 0 ? 'is-zero' : ''}`}>
            <IconFlame size={18} className="streak-flame" />
            <span>{currentStreak}</span>
          </div>
          {streak?.freezes_available > 0 && (
            <div className="freeze-badge">
              <IconSnowflake size={16} />
              <span>{streak.freezes_available}</span>
            </div>
          )}
          <button className={`btn-icon ${pushEnabled ? 'is-active' : ''}`} onClick={handleBellClick} disabled={pushBusy}>
            {pushEnabled ? <IconBellRinging size={20} /> : <IconBell size={20} />}
          </button>
        </div>
      </header>

      {pushMessage && <p className="home-push-message">{pushMessage}</p>}

      <main className="content">
        {loading ? (
          <div className="home-loading"><p>Loading your plants...</p></div>
        ) : error ? (
          <div className="home-error">
            <p>{error}</p>
            <button className="btn-primary" onClick={fetchPlants} style={{ maxWidth: '160px' }}>Try again</button>
          </div>
        ) : plants.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🪴</div>
            <h3>No plants yet!</h3>
            <p>Add your first plant and start your streak</p>
            <button className="btn-primary" style={{ maxWidth: '220px' }} onClick={() => navigate('/add')}>+ Add a plant</button>
          </div>
        ) : (
          <div className="plant-grid">
            {plants.map(plant => {
              const img = photoUrls[plant.id] || plant.image_url
              return (
                <button key={plant.id} className="plant-card" onClick={() => navigate(`/plant/${plant.id}`)}>
                  {img
                    ? <img src={img} alt={plant.nickname} className="plant-card-image" />
                    : <div className="plant-card-noimg">🌿</div>}
                  <div className="plant-card-info">
                    <p className="plant-card-name">{plant.nickname}</p>
                    {plant.watering && <p className="plant-card-meta">💧 {plant.watering}</p>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>
      <BottomNav active="home" />
    </div>
  )
}