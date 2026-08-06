// Shared dropdown options + Perenual mapping helpers for plant care fields.
// Used by AddPlant.jsx and PlantDetail.jsx (edit form + display).
//
// NOTE ON i18n: `value` is the stable key stored in the database — never
// translated. `labelKey` points at the translation string shown to the
// user. Use t(labelKey) to display it, and labelFor()/optionLabel() below
// with a `t` function for convenience.

export const WATERING_OPTIONS = [
  { value: 'frequent', labelKey: 'plantFields.watering.frequent' },
  { value: 'average', labelKey: 'plantFields.watering.average' },
  { value: 'minimum', labelKey: 'plantFields.watering.minimum' },
  { value: 'none', labelKey: 'plantFields.watering.none' },
  { value: 'soak_and_dry', labelKey: 'plantFields.watering.soak_and_dry' },
  { value: 'bottom_water', labelKey: 'plantFields.watering.bottom_water' },
]

export const SUNLIGHT_OPTIONS = [
  { value: 'full_sun', labelKey: 'plantFields.sunlight.full_sun' },
  { value: 'sun-part_shade', labelKey: 'plantFields.sunlight.sun-part_shade' },
  { value: 'part_shade', labelKey: 'plantFields.sunlight.part_shade' },
  { value: 'full_shade', labelKey: 'plantFields.sunlight.full_shade' },
  { value: 'bright_indirect', labelKey: 'plantFields.sunlight.bright_indirect' },
  { value: 'low_light', labelKey: 'plantFields.sunlight.low_light' },
  { value: 'morning_sun', labelKey: 'plantFields.sunlight.morning_sun' },
]

export const SOIL_TYPE_OPTIONS = [
  { value: 'well_draining', labelKey: 'plantFields.soilType.well_draining' },
  { value: 'sandy', labelKey: 'plantFields.soilType.sandy' },
  { value: 'loamy', labelKey: 'plantFields.soilType.loamy' },
  { value: 'clay', labelKey: 'plantFields.soilType.clay' },
  { value: 'peat_moss_based', labelKey: 'plantFields.soilType.peat_moss_based' },
  { value: 'orchid_bark', labelKey: 'plantFields.soilType.orchid_bark' },
]

export const HUMIDITY_OPTIONS = [
  { value: 'high', labelKey: 'plantFields.humidity.high' },
  { value: 'moderate', labelKey: 'plantFields.humidity.moderate' },
  { value: 'low', labelKey: 'plantFields.humidity.low' },
]

export const PH_LEVEL_OPTIONS = [
  { value: 'acidic', labelKey: 'plantFields.phLevel.acidic' },
  { value: 'neutral', labelKey: 'plantFields.phLevel.neutral' },
  { value: 'alkaline', labelKey: 'plantFields.phLevel.alkaline' },
]

export const FERTILIZER_FREQUENCY_OPTIONS = [
  { value: 'every_week', labelKey: 'plantFields.fertilizerFrequency.every_week' },
  { value: 'every_2_weeks', labelKey: 'plantFields.fertilizerFrequency.every_2_weeks' },
  { value: 'every_month', labelKey: 'plantFields.fertilizerFrequency.every_month' },
  { value: 'growing_season_only', labelKey: 'plantFields.fertilizerFrequency.growing_season_only' },
  { value: 'rarely', labelKey: 'plantFields.fertilizerFrequency.rarely' },
  { value: 'never', labelKey: 'plantFields.fertilizerFrequency.never' },
]

export const PRUNING_FREQUENCY_OPTIONS = [
  { value: 'monthly', labelKey: 'plantFields.pruningFrequency.monthly' },
  { value: 'seasonal', labelKey: 'plantFields.pruningFrequency.seasonal' },
  { value: 'yearly', labelKey: 'plantFields.pruningFrequency.yearly' },
  { value: 'as_needed', labelKey: 'plantFields.pruningFrequency.as_needed' },
  { value: 'never', labelKey: 'plantFields.pruningFrequency.never' },
]

export const CYCLE_OPTIONS = [
  { value: 'perennial', labelKey: 'plantFields.cycle.perennial' },
  { value: 'annual', labelKey: 'plantFields.cycle.annual' },
  { value: 'biennial', labelKey: 'plantFields.cycle.biennial' },
]

export const DIFFICULTY_OPTIONS = [
  { value: 'easy', labelKey: 'plantFields.difficulty.easy' },
  { value: 'moderate', labelKey: 'plantFields.difficulty.moderate' },
  { value: 'advanced', labelKey: 'plantFields.difficulty.advanced' },
]

// Looks up the translated label for a stored dropdown value.
// Falls back to the raw value if there's no match (e.g. legacy free-text data
// that doesn't match one of our normalized keys — can't be translated).
export function labelFor(options, value, t) {
  if (!value) return null
  const match = options.find((o) => o.value === value)
  return match ? t(match.labelKey) : value
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
