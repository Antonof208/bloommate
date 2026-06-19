import { useState } from 'react'
import { IconBell } from '@tabler/icons-react'
import BottomNav from '../components/BottomNav'

export default function Home({ session }) {
  const [plants] = useState([])
  const name = session.user.email.split('@')[0]

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
        {plants.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🪴</div>
            <h3>No plants yet!</h3>
            <p>Add your first plant and start your streak</p>
            <button className="btn-primary" style={{ maxWidth: '220px' }}>
              + Add a plant
            </button>
          </div>
        ) : (
          <div className="plant-grid">
            {plants.map(plant => (
              <div key={plant.id} className="plant-card">{plant.name}</div>
            ))}
          </div>
        )}
      </main>

      <BottomNav active="home" />
    </div>
  )
}