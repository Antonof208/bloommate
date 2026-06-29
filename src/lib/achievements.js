import { supabase } from './supabase'

import firstLeafImg from '../assets/achievements/first-leaf.png'
import plantParentImg from '../assets/achievements/plant-parent.png'
import collectorImg from '../assets/achievements/collector.png'
import jungleModeImg from '../assets/achievements/jungle-mode.png'
import firstDropImg from '../assets/achievements/first-drop.png'
import snipSnipImg from '../assets/achievements/snip-snip.png'
import diligentImg from '../assets/achievements/diligent.png'
import earlyBirdImg from '../assets/achievements/early-bird.png'
import nightOwlImg from '../assets/achievements/night-owl.png'
import hotStartImg from '../assets/achievements/hot-start.png'
import weekWarriorImg from '../assets/achievements/week-warrior.png'
import streakMasterImg from '../assets/achievements/streak-master.png'
import legendImg from '../assets/achievements/legend.png'
import bloomCamImg from '../assets/achievements/bloom-cam.png'

export const ACHIEVEMENTS = [
  { key: 'first-leaf',     name: 'First Leaf',     description: 'Add your first plant',      image: firstLeafImg },
  { key: 'plant-parent',   name: 'Plant Parent',   description: 'Add 3 plants',               image: plantParentImg },
  { key: 'collector',      name: 'Collector',      description: 'Own 5 plants',               image: collectorImg },
  { key: 'jungle-mode',    name: 'Jungle Mode',    description: 'Own 10 plants',              image: jungleModeImg },
  { key: 'first-drop',     name: 'First Drop',     description: 'Log your first watering',    image: firstDropImg },
  { key: 'snip-snip',      name: 'Snip Snip',      description: 'Log your first cut',         image: snipSnipImg },
  { key: 'diligent',       name: 'Diligent',       description: 'Log 20 care actions',        image: diligentImg },
  { key: 'early-bird',     name: 'Early Bird',     description: 'Log care before 7am',        image: earlyBirdImg },
  { key: 'night-owl',      name: 'Night Owl',      description: 'Log care after 10pm',        image: nightOwlImg },
  { key: 'hot-start',      name: 'Hot Start',      description: 'Reach a 3-day streak',       image: hotStartImg },
  { key: 'week-warrior',   name: 'Week Warrior',   description: 'Reach a 7-day streak',       image: weekWarriorImg },
  { key: 'streak-master',  name: 'Streak Master',  description: 'Reach a 30-day streak',      image: streakMasterImg },
  { key: 'legend',         name: 'Legend',         description: 'Reach a 100-day streak',     image: legendImg },
  { key: 'bloom-cam',      name: 'Bloom Cam',      description: 'Take a photo of your plant', image: bloomCamImg, phase3: true },
]

export async function checkAndUnlockAchievements(userId) {
  try {
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('achievement_key')
      .eq('user_id', userId)

    const alreadyUnlocked = new Set((existing || []).map(r => r.achievement_key))

    const [{ data: plants }, { data: logs }, { data: streak }] = await Promise.all([
      supabase.from('plants').select('id').eq('user_id', userId),
      supabase.from('care_logs').select('action, logged_at').eq('user_id', userId),
      supabase.from('user_streaks').select('current_streak, longest_streak').eq('user_id', userId).maybeSingle(),
    ])

    const plantCount = plants?.length || 0
    const allLogs = logs || []
    const bestStreak = Math.max(streak?.current_streak || 0, streak?.longest_streak || 0)
    const toUnlock = []

    const check = (key, condition) => {
      if (condition && !alreadyUnlocked.has(key)) toUnlock.push(key)
    }

    check('first-leaf',    plantCount >= 1)
    check('plant-parent',  plantCount >= 3)
    check('collector',     plantCount >= 5)
    check('jungle-mode',   plantCount >= 10)
    check('first-drop',    allLogs.some(l => l.action === 'water'))
    check('snip-snip',     allLogs.some(l => l.action === 'cut'))
    check('diligent',      allLogs.length >= 20)
    check('early-bird',    allLogs.some(l => new Date(l.logged_at).getHours() < 7))
    check('night-owl',     allLogs.some(l => new Date(l.logged_at).getHours() >= 22))
    check('hot-start',     bestStreak >= 3)
    check('week-warrior',  bestStreak >= 7)
    check('streak-master', bestStreak >= 30)
    check('legend',        bestStreak >= 100)
    // bloom-cam: unlocked manually in Phase 3

    if (toUnlock.length > 0) {
      await supabase.from('user_achievements').insert(
        toUnlock.map(key => ({ user_id: userId, achievement_key: key }))
      )
    }

    return toUnlock
  } catch (err) {
    console.error('Achievement check failed:', err)
    return []
  }
}