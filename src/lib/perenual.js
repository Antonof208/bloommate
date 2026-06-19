const PERENUAL_BASE = 'https://perenual.com/api/v2';
const API_KEY = import.meta.env.VITE_PERENUAL_API_KEY;

export async function searchPlants(query) {
  if (!query || query.trim().length < 2) return [];

  const res = await fetch(
    `${PERENUAL_BASE}/species-list?key=${API_KEY}&q=${encodeURIComponent(query)}`
  );

  if (!res.ok) {
    throw new Error('Perenual search failed');
  }

  const json = await res.json();
  return json.data || [];
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