import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconDroplet, IconLeaf, IconScissors } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { formatRelativeDay, formatTime } from '../lib/dateUtils'
import './CareHistory.css'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchData()
  }, [id])

  async function fetchData() {
    setLoading(true)
    setError(null)

    const [{ data: plant, error: plantError }, { data: logData, error: logsError }] = await Promise.all([
      supabase.from('plants').select('nickname').eq('id', id).single(),
      supabase.from('care_logs').select('*').eq('plant_id', id).order('logged_at', { ascending: false }),
    ])

    if (plantError || logsError) {
      setError('Could not load history.')
    } else {
      setPlantName(plant.nickname)
      setLogs(logData)
    }
    setLoading(false)
  }

  const groups = []
  for (const log of logs) {
    const dayLabel = formatRelativeDay(log.logged_at)
    let group = groups.find((g) => g.label === dayLabel)
    if (!group) {
      group = { label: dayLabel, items: [] }
      groups.push(group)
    }
    group.items.push(log)
  }

  return (
    <div className="careh-page">
      <div className="careh-header">
        <button className="careh-back" onClick={() => navigate(`/plant/${id}`)}>
          <IconArrowLeft size={22} />
        </button>
        <h1>{plantName ? `${plantName}'s history` : 'History'}</h1>
      </div>

      {loading ? (
        <p className="careh-empty">Loading...</p>
      ) : error ? (
        <p className="careh-empty">{error}</p>
      ) : logs.length === 0 ? (
        <p className="careh-empty">No activity logged yet.</p>
      ) : (
        groups.map((group) => (
          <div key={group.label} className="careh-group">
            <p className="careh-group-label">{group.label}</p>
            {group.items.map((log) => {
              const meta = ACTION_META[log.action]
              const Icon = meta.icon
              return (
                <div key={log.id} className="careh-row">
                  <div className="careh-row-icon">
                    <Icon size={18} />
                  </div>
                  <span className="careh-row-label">{meta.label}</span>
                  <span className="careh-row-time">{formatTime(log.logged_at)}</span>
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}