import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconDroplet, IconSun, IconRefresh, IconGauge, IconPencil, IconTrash, IconCheck, IconX } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import './PlantDetail.css'
import sadMascot from '../assets/mascot/sad.png'

export default function PlantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [plant, setPlant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

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

  function startEdit() {
    setForm({
      nickname: plant.nickname || '',
      common_name: plant.common_name || '',
      scientific_name: plant.scientific_name || '',
      watering: plant.watering || '',
      sunlight: plant.sunlight || '',
      cycle: plant.cycle || '',
      care_level: plant.care_level || '',
    })
    setSaveError(null)
    setEditing(true)
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!form.nickname.trim()) return

    setSaving(true)
    setSaveError(null)
    try {
      const { data, error } = await supabase
        .from('plants')
        .update({
          nickname: form.nickname.trim(),
          common_name: form.common_name || null,
          scientific_name: form.scientific_name || null,
          watering: form.watering || null,
          sunlight: form.sunlight || null,
          cycle: form.cycle || null,
          care_level: form.care_level || null,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setPlant(data)
      setEditing(false)
    } catch (err) {
      setSaveError('Could not save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const { error } = await supabase.from('plants').delete().eq('id', id)
      if (error) throw error
      navigate('/')
    } catch (err) {
      setDeleteError('Could not delete this plant. Please try again.')
      setDeleting(false)
    }
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

  if (error) {
    return (
      <div className="plantdetail-page">
        <div className="plantdetail-header">
          <button className="plantdetail-back" onClick={() => navigate('/')}>
            <IconArrowLeft size={22} />
          </button>
        </div>
        <p className="plantdetail-error">{error}</p>
      </div>
    )
  }

  if (!plant) return null

  if (confirmingDelete) {
  return (
    <div className="plantdetail-page">
      <div className="plantdetail-confirm">
        <img src={sadMascot} alt="BloomMate looking sad" className="plantdetail-confirm-mascot" />
        <h2>Delete {plant.nickname}?</h2>
        <p>This can't be undone.</p>
        {deleteError && <p className="plantdetail-error">{deleteError}</p>}
        <div className="plantdetail-confirm-actions">
          <button
            className="plantdetail-cancel-btn"
            onClick={() => setConfirmingDelete(false)}
            disabled={deleting}
          >
            Keep it
          </button>
          <button
            className="plantdetail-delete-btn"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

  if (editing) {
    return (
      <div className="plantdetail-page">
        <div className="plantdetail-header">
          <button className="plantdetail-back" onClick={() => setEditing(false)}>
            <IconX size={22} />
          </button>
          <h1>Edit plant</h1>
        </div>

        <form className="plantdetail-form" onSubmit={handleSaveEdit}>
          <label>
            Nickname *
            <input
              type="text"
              value={form.nickname}
              onChange={(e) => updateField('nickname', e.target.value)}
              required
            />
          </label>

          <label>
            Common name
            <input
              type="text"
              value={form.common_name}
              onChange={(e) => updateField('common_name', e.target.value)}
            />
          </label>

          <label>
            Scientific name
            <input
              type="text"
              value={form.scientific_name}
              onChange={(e) => updateField('scientific_name', e.target.value)}
            />
          </label>

          <label>
            Watering
            <input
              type="text"
              value={form.watering}
              onChange={(e) => updateField('watering', e.target.value)}
              placeholder="e.g. Average"
            />
          </label>

          <label>
            Sunlight
            <input
              type="text"
              value={form.sunlight}
              onChange={(e) => updateField('sunlight', e.target.value)}
              placeholder="e.g. Full sun"
            />
          </label>

          <label>
            Cycle
            <input
              type="text"
              value={form.cycle}
              onChange={(e) => updateField('cycle', e.target.value)}
              placeholder="e.g. Perennial"
            />
          </label>

          <label>
            Care level
            <input
              type="text"
              value={form.care_level}
              onChange={(e) => updateField('care_level', e.target.value)}
              placeholder="e.g. Easy"
            />
          </label>

          {saveError && <p className="plantdetail-error">{saveError}</p>}

          <button type="submit" className="plantdetail-save-btn" disabled={saving}>
            <IconCheck size={18} />
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
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
        <div className="plantdetail-header-actions">
          <button className="plantdetail-icon-btn" onClick={startEdit}>
            <IconPencil size={20} />
          </button>
          <button className="plantdetail-icon-btn plantdetail-icon-btn-danger" onClick={() => setConfirmingDelete(true)}>
            <IconTrash size={20} />
          </button>
        </div>
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