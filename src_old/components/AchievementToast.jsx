import { useEffect } from 'react'
import './AchievementToast.css'

export default function AchievementToast({ achievement, onDismiss }) {
  useEffect(() => {
    if (!achievement) return
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [achievement, onDismiss])

  if (!achievement) return null

  return (
    <div className="ach-toast" onClick={onDismiss}>
      <div className="ach-toast-icon" style={{ background: achievement.color }}>
        {achievement.emoji}
      </div>
      <div className="ach-toast-body">
        <p className="ach-toast-headline">Achievement unlocked! 🎉</p>
        <p className="ach-toast-name">{achievement.name}</p>
        <p className="ach-toast-desc">{achievement.description}</p>
      </div>
    </div>
  )
}