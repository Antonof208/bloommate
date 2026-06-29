import { useState, useEffect } from 'react'
import { IconFlame, IconChevronLeft, IconChevronRight, IconLock } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { getLocalDateString } from '../lib/dateUtils'
import { ACHIEVEMENTS, checkAndUnlockAchievements } from '../lib/achievements'
import BottomNav from '../components/BottomNav'
import './Wins.css'

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function Wins({ session }) {
  const [unlockedKeys, setUnlockedKeys] = useState(new Set())
  const [streak, setStreak] = useState(null)
  const [careDays, setCareDays] = useState(new Set())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [toastQueue, setToastQueue] = useState([])
  const [activeToast, setActiveToast] = useState(null)
  const [toastVisible, setToastVisible] = useState(false)

  useEffect(() => { loadAll() }, [])
  useEffect(() => { fetchCareDays(calYear, calMonth) }, [calYear, calMonth])

  // Toast queue
  useEffect(() => {
    if (activeToast || toastQueue.length === 0) return
    const next = toastQueue[0]
    setToastQueue(prev => prev.slice(1))
    setActiveToast(next)
    requestAnimationFrame(() => requestAnimationFrame(() => setToastVisible(true)))
    setTimeout(() => {
      setToastVisible(false)
      setTimeout(() => setActiveToast(null), 350)
    }, 3000)
  }, [toastQueue, activeToast])

  async function loadAll() {
    setLoading(true)
    const userId = session.user.id

    const newlyUnlocked = await checkAndUnlockAchievements(userId)
    if (newlyUnlocked.length > 0) setToastQueue(newlyUnlocked)

    const [{ data: achieved }, { data: streakData }] = await Promise.all([
      supabase.from('user_achievements').select('achievement_key').eq('user_id', userId),
      supabase.from('user_streaks').select('*').eq('user_id', userId).maybeSingle(),
    ])

    setUnlockedKeys(new Set((achieved || []).map(r => r.achievement_key)))
    setStreak(streakData)
    setLoading(false)
  }

  async function fetchCareDays(year, month) {
    const start = new Date(year, month, 1).toISOString()
    const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    const { data } = await supabase
      .from('care_logs')
      .select('logged_at')
      .eq('user_id', session.user.id)
      .gte('logged_at', start)
      .lte('logged_at', end)
    setCareDays(new Set((data || []).map(l => getLocalDateString(new Date(l.logged_at)))))
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }

  function nextMonth() {
    const now = new Date()
    if (calYear === now.getFullYear() && calMonth >= now.getMonth()) return
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  function buildCalendarDays() {
    const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return cells
  }

  const now = new Date()
  const isCurrentMonthView = calYear === now.getFullYear() && calMonth === now.getMonth()
  const calDays = buildCalendarDays()
  const toastAchievement = activeToast ? ACHIEVEMENTS.find(a => a.key === activeToast) : null

  if (loading) return (
    <div className="page">
      <div className="wins-loading">Loading your wins...</div>
      <BottomNav active="wins" />
    </div>
  )

  return (
    <div className="page">
      <header className="app-header">
        <h2>Wins 🏆</h2>
      </header>

      <main className="content">

        {/* Streak */}
        <div className="wins-streak-card">
          <div className="wins-streak-left">
            <span className="wins-streak-number">{streak?.current_streak || 0}</span>
            <div>
              <p className="wins-streak-label">day streak</p>
              <p className="wins-streak-best">Best: {streak?.longest_streak || 0} days</p>
            </div>
          </div>
          <IconFlame size={52} className="wins-streak-flame" />
        </div>

        {/* Calendar */}
        <div className="wins-calendar-card">
          <div className="wins-calendar-header">
            <button className="wins-cal-nav" onClick={prevMonth}>
              <IconChevronLeft size={18} />
            </button>
            <span className="wins-cal-month">{MONTH_NAMES[calMonth]} {calYear}</span>
            <button className="wins-cal-nav" onClick={nextMonth} disabled={isCurrentMonthView}>
              <IconChevronRight size={18} />
            </button>
          </div>
          <div className="wins-calendar-grid">
            {DAY_HEADERS.map((d, i) => <div key={i} className="wins-cal-dayname">{d}</div>)}
            {calDays.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const hasLog = careDays.has(dateStr)
              const isToday = isCurrentMonthView && day === now.getDate()
              return (
                <div key={day} className={`wins-cal-day ${hasLog ? 'has-log' : ''} ${isToday ? 'is-today' : ''}`}>
                  {day}
                </div>
              )
            })}
          </div>
        </div>

        {/* Achievements */}
        <h3 className="wins-section-title">Achievements</h3>
        <p className="wins-section-sub">{unlockedKeys.size} of {ACHIEVEMENTS.length} unlocked</p>

        <div className="wins-achievements-grid">
          {ACHIEVEMENTS.map(a => {
            const unlocked = unlockedKeys.has(a.key)
            return (
              <div key={a.key} className={`wins-badge ${!unlocked ? 'is-locked' : ''}`}>
                <div className="wins-badge-img-wrap">
                  <img src={a.image} alt={a.name} className="wins-badge-img" />
                  {!unlocked && (
                    <div className="wins-badge-lock-overlay">
                      <IconLock size={22} color="white" />
                    </div>
                  )}
                </div>
                <p className="wins-badge-name">{a.name}</p>
                <p className="wins-badge-desc">{a.description}</p>
              </div>
            )
          })}
        </div>

      </main>

      <BottomNav active="wins" />

      {/* Toast */}
      {toastAchievement && (
        <div className={`achievement-toast ${toastVisible ? 'is-visible' : ''}`}>
          <img src={toastAchievement.image} alt={toastAchievement.name} className="achievement-toast-img" />
          <div>
            <p className="achievement-toast-label">Achievement unlocked! 🎉</p>
            <p className="achievement-toast-name">{toastAchievement.name}</p>
          </div>
        </div>
      )}
    </div>
  )
}