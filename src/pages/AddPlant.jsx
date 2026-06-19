import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconSearch, IconArrowLeft, IconPlus, IconCheck } from '@tabler/icons-react';
import { supabase } from '../lib/supabase';
import { searchPlants, getPlantDetails } from '../lib/perenual';
import thinkingMascot from '../assets/mascot/thinking.png';
import celebratingMascot from '../assets/mascot/celebrating.png';
import './AddPlant.css';

export default function AddPlant() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [mode, setMode] = useState('search'); // 'search' | 'form'
  const [form, setForm] = useState({
    nickname: '',
    common_name: '',
    scientific_name: '',
    perenual_id: null,
    image_url: '',
    watering: '',
    sunlight: '',
    cycle: '',
    care_level: '',
  });

  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const data = await searchPlants(query);
        setResults(data);
      } catch (err) {
        setSearchError("Couldn't reach the plant database. Try again or add manually.");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function handleSelectResult(result) {
    setLoadingDetails(true);
    try {
      const details = await getPlantDetails(result.id);
      setForm({
        nickname: details.common_name || '',
        common_name: details.common_name || '',
        scientific_name: details.scientific_name?.[0] || '',
        perenual_id: details.id,
        image_url: details.default_image?.medium_url || details.default_image?.regular_url || '',
        watering: details.watering || '',
        sunlight: Array.isArray(details.sunlight) ? details.sunlight.join(', ') : (details.sunlight || ''),
        cycle: details.cycle || '',
        care_level: details.care_level || '',
      });
      setMode('form');
    } catch (err) {
      setSearchError("Couldn't load details for that plant. Try another or add manually.");
    } finally {
      setLoadingDetails(false);
    }
  }

  function startManualEntry() {
    setForm({
      nickname: '',
      common_name: '',
      scientific_name: '',
      perenual_id: null,
      image_url: '',
      watering: '',
      sunlight: '',
      cycle: '',
      care_level: '',
    });
    setMode('form');
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.nickname.trim()) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('plants').insert({
        user_id: user.id,
        nickname: form.nickname.trim(),
        common_name: form.common_name || null,
        scientific_name: form.scientific_name || null,
        perenual_id: form.perenual_id,
        image_url: form.image_url || null,
        watering: form.watering || null,
        sunlight: form.sunlight || null,
        cycle: form.cycle || null,
        care_level: form.care_level || null,
      });

      if (error) throw error;

      setSaved(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setSearchError('Could not save your plant. Please try again.');
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="addplant-celebrate">
        <img src={celebratingMascot} alt="BloomMate celebrating" className="addplant-mascot-large" />
        <h2>{form.nickname} added! 🌱</h2>
      </div>
    );
  }

  return (
    <div className="addplant-page">
      <div className="addplant-header">
        <button className="addplant-back" onClick={() => mode === 'form' ? setMode('search') : navigate('/')}>
          <IconArrowLeft size={22} />
        </button>
        <h1>{mode === 'search' ? 'Add a plant' : 'Plant details'}</h1>
      </div>

      {mode === 'search' && (
        <>
          <div className="addplant-search-bar">
            <IconSearch size={20} className="addplant-search-icon" />
            <input
              type="text"
              placeholder="Search for a plant (e.g. monstera)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          {searching && (
            <div className="addplant-loading">
              <img src={thinkingMascot} alt="BloomMate thinking" className="addplant-mascot-small" />
              <p>Searching...</p>
            </div>
          )}

          {searchError && <p className="addplant-error">{searchError}</p>}

          {!searching && results.length > 0 && (
            <div className="addplant-results">
              {results.map((r) => (
                <button key={r.id} className="addplant-result-card" onClick={() => handleSelectResult(r)}>
                  {r.default_image?.thumbnail ? (
                    <img src={r.default_image.thumbnail} alt={r.common_name} />
                  ) : (
                    <div className="addplant-result-noimg">🌿</div>
                  )}
                  <div>
                    <p className="addplant-result-name">{r.common_name}</p>
                    {r.scientific_name?.[0] && (
                      <p className="addplant-result-sci">{r.scientific_name[0]}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {!searching && query.trim().length >= 2 && results.length === 0 && !searchError && (
            <p className="addplant-empty">No matches found.</p>
          )}

          <button className="addplant-manual-btn" onClick={startManualEntry}>
            <IconPlus size={18} />
            Can't find it? Add manually
          </button>
        </>
      )}

      {mode === 'form' && (
        <form className="addplant-form" onSubmit={handleSave}>
          {loadingDetails && <p>Loading plant info...</p>}

          {form.image_url && (
            <img src={form.image_url} alt={form.common_name} className="addplant-form-image" />
          )}

          <label>
            Nickname *
            <input
              type="text"
              value={form.nickname}
              onChange={(e) => updateField('nickname', e.target.value)}
              placeholder="What do you call this plant?"
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

          {searchError && <p className="addplant-error">{searchError}</p>}

          <button type="submit" className="addplant-save-btn" disabled={saving}>
            <IconCheck size={18} />
            {saving ? 'Saving...' : 'Save plant'}
          </button>
        </form>
      )}
    </div>
  );
}