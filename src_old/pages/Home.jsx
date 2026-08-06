import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBell, IconBellRinging, IconFlame, IconSnowflake, IconDroplet, IconInfoCircle, IconCheck } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { registerServiceWorker } from '../lib/push'
import { getMainPhotosForPlants } from '../lib/photos'
import { isToday, getLocalDateString } from '../lib/dateUtils'
import BottomNav from '../components/BottomNav'
import './Home.css'

export default function Home({ session }) {
  const navigate = useNavigate()
  const [plants, setPlants] = useState([])
  const [photoUrls, setPhotoUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [streak, setStreak] = useState(null)
  const [wateredToday, setWateredToday] = useState({})
  const [waterLoading, setWaterLoading] = useState(null)
  const name = session.user.user_metadata?.display_name || session.user.email.split('@')[0]

  useEffect(() => {
    fetchPlants()
    fetchStreak()
    registerServiceWorker()
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
      fetchWateredToday(data.map((p) => p.id))
    }
    setLoading(false)
  }

  async function fetchWateredToday(plantIds) {
    if (plantIds.length === 0) { setWateredToday({}); return }
    const { data, error } = await supabase
      .from('care_logs')
      .select('plant_id, logged_at')
      .in('plant_id', plantIds)
      .eq('action', 'water')
      .order('logged_at', { ascending: false })
    if (error) return
    const latestByPlant = {}
    for (const log of data) {
      if (!(log.plant_id in latestByPlant)) latestByPlant[log.plant_id] = log.logged_at
    }
    const doneMap = {}
    for (const [pid, loggedAt] of Object.entries(latestByPlant)) {
      doneMap[pid] = isToday(loggedAt)
    }
    setWateredToday(doneMap)
  }

  async function fetchStreak() {
    const { data } = await supabase.from('user_streaks').select('*').eq('user_id', session.user.id).maybeSingle()
    setStreak(data)
  }

  async function handleWaterLog(plantId, e) {
    e.stopPropagation()
    if (wateredToday[plantId] || waterLoading === plantId) return
    setWaterLoading(plantId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('care_logs').insert({ plant_id: plantId, user_id: user.id, action: 'water' })
      if (error) throw error
      setWateredToday((prev) => ({ ...prev, [plantId]: true }))
      const { error: streakError } = await supabase.rpc('bump_streak', { p_today: getLocalDateString() })
      if (streakError) console.error('Streak update failed:', streakError)
      fetchStreak()
    } catch (err) {
      console.error('Could not log water:', err)
    } finally {
      setWaterLoading(null)
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
          <button
            className={`streak-badge ${currentStreak === 0 ? 'is-zero' : ''}`}
            onClick={() => navigate('/wins')}
          >
            <IconFlame size={18} className="streak-flame" />
            <span>{currentStreak}</span>
          </button>
          {streak?.freezes_available > 0 && (
            <div className="freeze-badge">
              <IconSnowflake size={16} />
              <span>{streak.freezes_available}</span>
            </div>
          )}
          <button className="btn-icon" onClick={() => navigate('/reminders')}>
            <IconBell size={20} />
          </button>
        </div>
      </header>

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
              const doneToday = !!wateredToday[plant.id]
              const isWatering = waterLoading === plant.id
              return (
                <div key={plant.id} className="plant-card">
                  <div className="plant-card-tap" onClick={() => navigate(`/plant/${plant.id}`)}>
                    {img
                      ? <img src={img} alt={plant.nickname} className="plant-card-image" />
                      : <div className="plant-card-noimg">🌿</div>}
                    <div className="plant-card-info">
                      <p className="plant-card-name">{plant.nickname}</p>
                    </div>
                  </div>
                  <div className="plant-card-actions">
                    <button
                      className={`plant-card-water-btn ${doneToday ? 'is-done' : ''}`}
                      onClick={(e) => handleWaterLog(plant.id, e)}
                      disabled={doneToday || isWatering}
                    >
                      {doneToday ? <IconCheck size={16} /> : <IconDroplet size={16} />}
                      {isWatering ? 'Watering...' : doneToday ? 'Watered' : 'Water'}
                    </button>
                    <button
                      className="plant-card-info-btn"
                      onClick={(e) => { e.stopPropagation(); navigate(`/plant/${plant.id}`) }}
                    >
                      <IconInfoCircle size={18} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      <BottomNav active="home" />
    </div>
  )
}