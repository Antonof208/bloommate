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
  if (isToday(dateString)) return 'Today'
  if (isYesterday(dateString)) return 'Yesterday'

  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(dateString)) / 86400000)
  if (diffDays < 7) return `${diffDays} days ago`

  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}