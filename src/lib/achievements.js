import { supabase } from './supabase'

export const ACHIEVEMENTS = [
  { id: 'first_leaf',     name: 'First Leaf',     description: 'Added your first plant',      emoji: '🌱', color: '#3DCC78', darkColor: '#2AA862' },
  { id: 'first_drop',     name: 'First Drop',     description: 'Logged your first watering',  emoji: '💧', color: '#4AADE8', darkColor: '#2980B9' },
  { id: 'snip_snip',      name: 'Snip Snip',      description: 'Logged your first cut',        emoji: '✂️', color: '#A855F7', darkColor: '#7C3AED' },
  { id: 'collector',      name: 'Collector',      description: 'Own 5 plants',                 emoji: '🌿', color: '#2AA862', darkColor: '#1A7A46' },
  { id: 'week_warrior',   name: 'Week Warrior',   description: 'Reached a 7-day streak',       emoji: '🔥', color: '#FF6B35', darkColor: '#CC4A1A' },
  { id: 'diligent',       name: 'Diligent',       description: 'Logged 20 care actions',       emoji: '📋', color: '#0EA5E9', darkColor: '#0369A1' },
  { id: 'streak_master',  name: 'Streak Master',  description: 'Reached a 30-day streak',      emoji: '🏆', color: '#EAB308', darkColor: '#A16207' },
  { id: 'bloom_cam',      name: 'Bloom Cam',      description: 'Took a photo of your plant',   emoji: '📸', color: '#EC4899', darkColor: '#BE185D', comingSoon: true },
]

export function getSeenAchievements() {
  try {
    return new Set(JSON.parse(localStorage.getItem('bloommate_seen_achievements') || '[]'))
  } catch {
    return new Set()
  }
}

export function markAchievementsSeen(ids) {
  const seen = getSeenAchievements()
  ids.forEach((id) => seen.add(id))
  localStorage.setItem('bloommate_seen_achievements', JSON.stringify([...seen]))
}

export async function computeUnlockedIds(userId) {
  const [{ data: plants }, { data: careLogs }, { data: streak }] = await Promise.all([
    supabase.from('plants').select('id').eq('user_id', userId),
    supabase.from('care_logs').select('action').eq('user_id', userId),
    supabase.from('user_streaks').select('longest_streak').eq('user_id', userId).maybeSingle(),
  ])
  const plantCount = plants?.length || 0
  const logs = careLogs || []
  const longestStreak = streak?.longest_streak || 0
  const unlocked = new Set()
  if (plantCount >= 1) unlocked.add('first_leaf')
  if (logs.some((l) => l.action === 'water')) unlocked.add('first_drop')
  if (logs.some((l) => l.action === 'cut')) unlocked.add('snip_snip')
  if (plantCount >= 5) unlocked.add('collector')
  if (longestStreak >= 7) unlocked.add('week_warrior')
  if (logs.length >= 20) unlocked.add('diligent')
  if (longestStreak >= 30) unlocked.add('streak_master')
  return unlocked
}

export async function initAchievements(userId) {
  if (localStorage.getItem('bloommate_achievements_initialized')) return
  const unlocked = await computeUnlockedIds(userId)
  markAchievementsSeen([...unlocked])
  localStorage.setItem('bloommate_achievements_initialized', '1')
}

export async function checkNewAchievements(userId) {
  const unlocked = await computeUnlockedIds(userId)
  const seen = getSeenAchievements()
  const newIds = [...unlocked].filter((id) => !seen.has(id))
  if (newIds.length > 0) markAchievementsSeen(newIds)
  return newIds.map((id) => ACHIEVEMENTS.find((a) => a.id === id)).filter(Boolean)
}