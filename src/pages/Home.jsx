import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBell } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import './Home.css'

export default function Home({ session }) {
  const navigate = useNavigate()
  const [plants, setPlants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const name = session.user.email.split('@')[0]

  useEffect(() => {
    fetchPlants()
  }, [])

  async function fetchPlants() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('plants')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setError('Could not load your plants.')
    } else {
      setPlants(data)
    }
    setLoading(false)
  }

  return (
    <div className="page">
      <header className="app-header">
        <div>
          <p className="header-greeting">Hey {name} 👋</p>
          <h2>My Plants 🌿</h2>
        </div>
        <button className="btn-icon">
          <IconBell size={20} />
        </button>
      </header>

      <main className="content">
        {loading ? (
          <div className="home-loading">
            <p>Loading your plants...</p>
          </div>
        ) : error ? (
          <div className="home-error">
            <p>{error}</p>
            <button className="btn-primary" onClick={fetchPlants} style={{ maxWidth: '160px' }}>
              Try again
            </button>
          </div>
        ) : plants.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🪴</div>
            <h3>No plants yet!</h3>
            <p>Add your first plant and start your streak</p>
            <button className="btn-primary" style={{ maxWidth: '220px' }} onClick={() => navigate('/add')}>
              + Add a plant
            </button>
          </div>
        ) : (
          <div className="plant-grid">
            {plants.map(plant => (
              <button
                key={plant.id}
                className="plant-card"
                onClick={() => navigate(`/plant/${plant.id}`)}
              >
                {plant.image_url ? (
                  <img src={plant.image_url} alt={plant.nickname} className="plant-card-image" />
                ) : (
                  <div className="plant-card-noimg">🌿</div>
                )}
                <div className="plant-card-info">
                  <p className="plant-card-name">{plant.nickname}</p>
                  {plant.watering && (
                    <p className="plant-card-meta">💧 {plant.watering}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <BottomNav active="home" />
    </div>
  )
}