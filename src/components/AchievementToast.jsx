import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './AchievementToast.css'

export default function AchievementToast({ achievement, onDismiss }) {
  const { t } = useTranslation()

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
        <p className="ach-toast-headline">{t('wins.achievementUnlocked')}</p>
        <p className="ach-toast-name">{t(`achievements.${achievement.key}.name`)}</p>
        <p className="ach-toast-desc">{t(`achievements.${achievement.key}.description`)}</p>
      </div>
    </div>
  )
}
