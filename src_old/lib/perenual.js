const PERENUAL_BASE = 'https://perenual.com/api/v2';
const PERENUAL_ROOT = 'https://perenual.com/api';
const API_KEY = import.meta.env.VITE_PERENUAL_API_KEY;

// Ranks and cleans raw Perenual search results before showing them.
// Perenual's own `q=` matching is a loose substring search with no
// relevance sort, so we do it client-side:
//   1. drop junk entries (no image AND no common name — usually bad data)
//   2. rank exact match > starts-with > contains, by common name
function rankAndFilterResults(results, query) {
  const q = query.trim().toLowerCase();

  const cleaned = results.filter((r) => {
    const hasName = Boolean(r.common_name && r.common_name.trim());
    const hasImage = Boolean(r.default_image?.thumbnail);
    return hasName || hasImage;
  });

  function score(r) {
    const name = (r.common_name || '').toLowerCase();
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.includes(q)) return 2;
    return 3;
  }

  return cleaned.sort((a, b) => score(a) - score(b));
}

export async function searchPlants(query) {
  if (!query || query.trim().length < 2) return [];

  const res = await fetch(
    `${PERENUAL_BASE}/species-list?key=${API_KEY}&q=${encodeURIComponent(query)}`
  );

  if (!res.ok) {
    throw new Error('Perenual search failed');
  }

  const json = await res.json();
  const raw = json.data || [];
  return rankAndFilterResults(raw, query);
}

export async function getPlantDetails(id) {
  const res = await fetch(
    `${PERENUAL_BASE}/species/details/${id}?key=${API_KEY}`
  );

  if (!res.ok) {
    throw new Error('Perenual details fetch failed');
  }

  return res.json();
}

// Fetches the plain-language care guide paragraphs for a species
// (watering, sunlight, pruning, etc). Returns an object keyed by topic,
// e.g. { watering: "...", sunlight: "...", pruning: "..." }, or null if
// no guide exists for this species. Never throws — this is best-effort
// bonus content, so a failure here should never block saving a plant.
export async function getCareGuide(speciesId) {
  if (!speciesId) return null;
  try {
    const res = await fetch(
      `${PERENUAL_ROOT}/species-care-guide-list?key=${API_KEY}&species_id=${speciesId}`
    );
    if (!res.ok) return null;

    const json = await res.json();
    const entry = json.data?.[0];
    if (!entry || !Array.isArray(entry.section)) return null;

    const guide = {};
    for (const s of entry.section) {
      if (s.type && s.description) guide[s.type] = s.description;
    }
    return Object.keys(guide).length > 0 ? guide : null;
  } catch (err) {
    console.error('Could not fetch care guide:', err);
    return null;
  }
}