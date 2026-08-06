import i18n from '../i18n'

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isToday(dateString) {
  return startOfDay(dateString).getTime() === startOfDay(new Date()).getTime()
}

export function isYesterday(dateString) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return startOfDay(dateString).getTime() === startOfDay(yesterday).getTime()
}

export function formatRelativeDay(dateString) {
  if (isToday(dateString)) return i18n.t('dateUtils.today')
  if (isYesterday(dateString)) return i18n.t('dateUtils.yesterday')

  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(dateString)) / 86400000)
  if (diffDays < 7) return i18n.t('dateUtils.daysAgo', { count: diffDays })

  return new Date(dateString).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })
}

export function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' })
}

export function getLocalDateString(date = new Date()) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
