import { useState, useEffect } from 'react'
import { IconFlame, IconLock } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { ACHIEVEMENTS, computeUnlockedIds } from '../lib/achievements'
import BottomNav from '../components/BottomNav'
import './Wins.css'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function ShieldBadge({ achievement, unlocked }) {
  return (
    <div className={`shield-outer ${unlocked ? 'shield-is-unlocked' : ''}`}>
      <div className="shield-inner-wrap">
        <div className={`shield-art-wrap ${!unlocked ? 'shield-art-locked' : ''}`}>
          <svg viewBox="0 0 100 114" xmlns="http://www.w3.org/2000/svg" className="shield-svg">
            <path
              d="M50,11 L88,25 L88,58 C88,80 72,98 50,108 C28,98 12,80 12,58 L12,25 Z"
              fill={unlocked ? achievement.darkColor : '#999'}
            />
            <path
              d="M50,8 L86,22 L86,56 C86,78 70,96 50,106 C30,96 14,78 14,56 L14,22 Z"
              fill={unlocked ? achievement.color : '#CCC'}
            />
            <path
              d="M50,14 L80,26 L80,50 C76,40 64,32 50,30 C36,32 24,40 20,50 L20,26 Z"
              fill="rgba(255,255,255,0.22)"
            />
          </svg>
          <div className="shield-emoji">{achievement.emoji}</div>
        </div>
        {!unlocked && (
          <div className="shield-lock-overlay">
            <IconLock size={18} color="white" />
          </div>
        )}
      </div>
      <p className={`shield-name ${!unlocked ? 'shield-name-locked' : ''}`}>{achievement.name}</p>
      <p className="shield-desc">{achievement.description}</p>
    </div>
  )
}

export default function Wins() {
  const [userId, setUserId] = useState(null)
  const [streak, setStreak] = useState(null)
  const [unlockedIds, setUnlockedIds] = useState(new Set())
  const [calendarDays, setCalendarDays] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  )

  useEffect(() => {
    async function init() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user.id)
      const [unlockedSet, { data: streakData }] = await Promise.all([
        computeUnlockedIds(user.id),
        supabase.from('user_streaks').select('*').eq('user_id', user.id).maybeSingle(),
      ])
      setUnlockedIds(unlockedSet)
      setStreak(streakData)
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (!userId) return
    setCalendarDays(new Set())
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const end = new Date(year, month + 1, 1).toISOString()
    supabase
      .from('care_logs')
      .select('logged_at')
      .eq('user_id', userId)
      .gte('logged_at', start)
      .lt('logged_at', end)
      .then(({ data }) => {
        setCalendarDays(new Set((data || []).map((l) => new Date(l.logged_at).getDate())))
      })
  }, [userId, calendarMonth])

  function buildCells() {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDow = new Date(year, month, 1).getDay()
    const totalDays = new Date(year, month + 1, 0).getDate()
    const today = new Date()
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
    const cells = []
    for (let i = 0; i < firstDow; i++) cells.push({ empty: true })
    for (let d = 1; d <= totalDays; d++) {
      cells.push({
        day: d,
        active: calendarDays.has(d),
        isToday: isCurrentMonth && d === today.getDate(),
        future: isCurrentMonth && d > today.getDate(),
      })
    }
    return cells
  }

  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const isNextDisabled = calendarMonth >= currentMonthStart
  const cells = buildCells()
  const currentStreak = streak?.current_streak || 0
  const longestStreak = streak?.longest_streak || 0

  return (
    <div className="page">
      <header className="app-header">
        <h2>My Wins 🏆</h2>
      </header>

      <main className="content">
        <div className="wins-streak-card">
          <div className="wins-streak-top">
            <div className="wins-streak-num">
              <IconFlame size={34} className="wins-flame" />
              <span>{currentStreak}</span>
            </div>
            <div>
              <p className="wins-streak-label">day streak</p>
              <p className="wins-streak-best">Best: {longestStreak} days</p>
            </div>
          </div>

          <div className="wins-cal">
            <div className="wins-cal-header">
              <button className="wins-cal-arrow" onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
              <p className="wins-cal-title">{MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</p>
              <button className="wins-cal-arrow" onClick={() => { if (!isNextDisabled) setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)) }} disabled={isNextDisabled}>›</button>
            </div>
            <div className="wins-cal-grid">
              {DAYS.map((d) => <p key={d} className="wins-cal-dow">{d}</p>)}
              {cells.map((cell, i) => (
                <div key={i} className={[
                  'wins-cal-day',
                  cell.empty   ? 'wins-cal-empty'  : '',
                  cell.active  ? 'wins-cal-active'  : '',
                  cell.isToday ? 'wins-cal-today'   : '',
                  cell.future  ? 'wins-cal-future'  : '',
                ].join(' ')}>
                  {cell.empty ? '' : cell.day}
                </div>
              ))}
            </div>
          </div>
        </div>

        <h3 className="wins-badges-title">Badges</h3>
        {loading ? (
          <p className="wins-loading">Loading...</p>
        ) : (
          <div className="wins-badges-grid">
            {ACHIEVEMENTS.map((a) => (
              <ShieldBadge key={a.id} achievement={a} unlocked={unlockedIds.has(a.id)} />
            ))}
          </div>
        )}
      </main>

      <BottomNav active="wins" />
    </div>
  )
}