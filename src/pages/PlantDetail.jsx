import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconDroplet, IconSun, IconRefresh, IconGauge } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import './PlantDetail.css'

export default function PlantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [plant, setPlant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchPlant()
  }, [id])

  async function fetchPlant() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('plants')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      setError("Couldn't find that plant.")
    } else {
      setPlant(data)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="plantdetail-page">
        <div className="plantdetail-header">
          <button className="plantdetail-back" onClick={() => navigate('/')}>
            <IconArrowLeft size={22} />
          </button>
        </div>
        <p className="plantdetail-loading">Loading...</p>
      </div>
    )
  }

  if (error || !plant) {
    return (
      <div className="plantdetail-page">
        <div className="plantdetail-header">
          <button className="plantdetail-back" onClick={() => navigate('/')}>
            <IconArrowLeft size={22} />
          </button>
        </div>
        <p className="plantdetail-error">{error || 'Plant not found.'}</p>
      </div>
    )
  }

  return (
    <div className="plantdetail-page">
      <div className="plantdetail-header">
        <button className="plantdetail-back" onClick={() => navigate('/')}>
          <IconArrowLeft size={22} />
        </button>
        <h1>{plant.nickname}</h1>
      </div>

      {plant.image_url ? (
        <img src={plant.image_url} alt={plant.nickname} className="plantdetail-image" />
      ) : (
        <div className="plantdetail-noimg">🌿</div>
      )}

      {(plant.common_name || plant.scientific_name) && (
        <div className="plantdetail-names">
          {plant.common_name && <p className="plantdetail-common">{plant.common_name}</p>}
          {plant.scientific_name && <p className="plantdetail-sci">{plant.scientific_name}</p>}
        </div>
      )}

      <div className="plantdetail-care-grid">
        {plant.watering && (
          <div className="plantdetail-care-card">
            <IconDroplet size={22} className="plantdetail-care-icon" />
            <p className="plantdetail-care-label">Watering</p>
            <p className="plantdetail-care-value">{plant.watering}</p>
          </div>
        )}
        {plant.sunlight && (
          <div className="plantdetail-care-card">
            <IconSun size={22} className="plantdetail-care-icon" />
            <p className="plantdetail-care-label">Sunlight</p>
            <p className="plantdetail-care-value">{plant.sunlight}</p>
          </div>
        )}
        {plant.cycle && (
          <div className="plantdetail-care-card">
            <IconRefresh size={22} className="plantdetail-care-icon" />
            <p className="plantdetail-care-label">Cycle</p>
            <p className="plantdetail-care-value">{plant.cycle}</p>
          </div>
        )}
        {plant.care_level && (
          <div className="plantdetail-care-card">
            <IconGauge size={22} className="plantdetail-care-icon" />
            <p className="plantdetail-care-label">Care level</p>
            <p className="plantdetail-care-value">{plant.care_level}</p>
          </div>
        )}
      </div>
    </div>
  )
}