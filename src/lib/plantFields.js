// Shared dropdown options + Perenual mapping helpers for plant care fields.
// Used by AddPlant.jsx and PlantDetail.jsx (edit form + display).

export const WATERING_OPTIONS = [
  { value: 'frequent', label: 'Frequent' },
  { value: 'average', label: 'Average' },
  { value: 'minimum', label: 'Minimum' },
  { value: 'none', label: 'None' },
  { value: 'soak_and_dry', label: 'Soak & Dry' },
  { value: 'bottom_water', label: 'Bottom Water' },
]

export const SUNLIGHT_OPTIONS = [
  { value: 'full_sun', label: 'Full Sun' },
  { value: 'sun-part_shade', label: 'Sun / Part Shade' },
  { value: 'part_shade', label: 'Part Shade' },
  { value: 'full_shade', label: 'Full Shade' },
  { value: 'bright_indirect', label: 'Bright Indirect' },
  { value: 'low_light', label: 'Low Light' },
  { value: 'morning_sun', label: 'Morning Sun' },
]

export const SOIL_TYPE_OPTIONS = [
  { value: 'well_draining', label: 'Well-Draining' },
  { value: 'sandy', label: 'Sandy' },
  { value: 'loamy', label: 'Loamy' },
  { value: 'clay', label: 'Clay' },
  { value: 'peat_moss_based', label: 'Peat Moss-Based' },
  { value: 'orchid_bark', label: 'Orchid Bark' },
]

export const HUMIDITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'low', label: 'Low' },
]

export const PH_LEVEL_OPTIONS = [
  { value: 'acidic', label: 'Acidic' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'alkaline', label: 'Alkaline' },
]

export const FERTILIZER_FREQUENCY_OPTIONS = [
  { value: 'every_week', label: 'Every Week' },
  { value: 'every_2_weeks', label: 'Every 2 Weeks' },
  { value: 'every_month', label: 'Every Month' },
  { value: 'growing_season_only', label: 'Growing Season Only' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'never', label: 'Never' },
]

export const PRUNING_FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'as_needed', label: 'As Needed' },
  { value: 'never', label: 'Never' },
]

export const CYCLE_OPTIONS = [
  { value: 'perennial', label: 'Perennial' },
  { value: 'annual', label: 'Annual' },
  { value: 'biennial', label: 'Biennial' },
]

export const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '🟢 Easy' },
  { value: 'moderate', label: '🟡 Moderate' },
  { value: 'advanced', label: '🔴 Advanced' },
]

// Looks up the friendly label for a stored dropdown value.
// Falls back to the raw value if there's no match (e.g. legacy free-text data).
export function labelFor(options, value) {
  if (!value) return null
  const match = options.find((o) => o.value === value)
  return match ? match.label : value
}

// ---- Perenual API -> our normalized dropdown keys ----
// humidity and fertilizer_frequency are intentionally left unmapped —
// Perenual's API has no fields for either, on any tier. Users fill those
// in manually via Edit. soil_type and pruning_frequency ARE mappable
// (see mapPerenualSoil / mapPerenualPruning below).

export function mapPerenualWatering(raw) {
  if (!raw) return null
  const key = raw.toLowerCase().trim()
  const map = { frequent: 'frequent', average: 'average', minimum: 'minimum', none: 'none' }
  return map[key] || null
}

export function mapPerenualSunlight(raw) {
  const arr = Array.isArray(raw) ? raw : (raw ? [raw] : [])
  const joined = arr.join(' ').toLowerCase()
  if (!joined) return null
  if (joined.includes('full sun') && joined.includes('part')) return 'sun-part_shade'
  if (joined.includes('full sun')) return 'full_sun'
  if (joined.includes('part shade') || joined.includes('part sun')) return 'part_shade'
  if (joined.includes('full shade')) return 'full_shade'
  if (joined.includes('filtered')) return 'bright_indirect'
  if (joined.includes('morning')) return 'morning_sun'
  return null
}

export function mapPerenualCycle(raw) {
  if (!raw) return null
  const key = raw.toLowerCase().trim()
  if (key.includes('biennial')) return 'biennial'
  if (key.includes('perennial')) return 'perennial'
  if (key.includes('annual')) return 'annual'
  return null
}

// Perenual doesn't always expose a clean pH field; this checks a couple of
// possible shapes and buckets a numeric range into acidic/neutral/alkaline.
export function mapPerenualPhLevel(details) {
  const min = details?.ph_minimum ?? details?.ph_min
  const max = details?.ph_maximum ?? details?.ph_max
  if (min == null && max == null) return null
  const nums = [min, max].filter((v) => v != null).map(Number).filter((n) => !Number.isNaN(n))
  if (nums.length === 0) return null
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length
  if (avg < 6) return 'acidic'
  if (avg > 7.5) return 'alkaline'
  return 'neutral'
}

// Perenual's `soil` field is an array of free-text tags, e.g.
// ["Loamy", "Sandy", "Well-drained", "Acidic"]. We scan for keywords and
// map to our closest single option. Order matters: more specific terms
// (peat, orchid bark) are checked before generic ones.
export function mapPerenualSoil(raw) {
  const arr = Array.isArray(raw) ? raw : (raw ? [raw] : [])
  const joined = arr.join(' ').toLowerCase()
  if (!joined) return null
  if (joined.includes('orchid') || joined.includes('bark')) return 'orchid_bark'
  if (joined.includes('peat')) return 'peat_moss_based'
  if (joined.includes('clay')) return 'clay'
  if (joined.includes('sand')) return 'sandy'
  if (joined.includes('loam')) return 'loamy'
  if (joined.includes('well-drain') || joined.includes('well drain')) return 'well_draining'
  return null
}

// Perenual's `pruning_count` looks like { amount: 1, interval: "yearly" }.
// We map the interval text to our closest frequency bucket.
export function mapPerenualPruning(pruningCount) {
  const interval = pruningCount?.interval
  if (!interval) return null
  const key = interval.toLowerCase().trim()
  if (key.includes('month')) return 'monthly'
  if (key.includes('season')) return 'seasonal'
  if (key.includes('year') || key.includes('annual')) return 'yearly'
  if (key.includes('need')) return 'as_needed'
  return null
}