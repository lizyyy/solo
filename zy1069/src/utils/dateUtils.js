export function formatDate(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatTime(time) {
  const [hours, minutes] = time.split(':')
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
}

export function parseDate(dateStr) {
  return new Date(dateStr)
}

export function isToday(date) {
  const today = new Date()
  const target = new Date(date)
  return (
    today.getFullYear() === target.getFullYear() &&
    today.getMonth() === target.getMonth() &&
    today.getDate() === target.getDate()
  )
}

export function isDateInRange(date, startDate, endDate) {
  const d = parseDate(date)
  const start = parseDate(startDate)
  const end = parseDate(endDate)
  
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)
  d.setHours(0, 0, 0, 0)
  
  return d >= start && d <= end
}

export function getDaysUntilExpiry(expiryDate) {
  const today = new Date()
  const expiry = new Date(expiryDate)
  
  today.setHours(0, 0, 0, 0)
  expiry.setHours(0, 0, 0, 0)
  
  const diffTime = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays
}

export function isExpired(expiryDate) {
  return getDaysUntilExpiry(expiryDate) < 0
}

export function isExpiringSoon(expiryDate, daysThreshold = 30) {
  const days = getDaysUntilExpiry(expiryDate)
  return days >= 0 && days <= daysThreshold
}

export function getAgeGroup(age) {
  if (age <= 3) return 'infant'
  if (age <= 12) return 'child'
  if (age <= 17) return 'teen'
  if (age <= 64) return 'adult'
  return 'elderly'
}

export function timeToMinutes(timeStr) {
  if (!timeStr) return 0
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + (minutes || 0)
}

export function getTimeDifference(time1, time2) {
  const mins1 = timeToMinutes(time1)
  const mins2 = timeToMinutes(time2)
  return Math.abs(mins1 - mins2)
}

export function getTodayString() {
  return formatDate(new Date())
}

export function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function getWeekday(date) {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `周${weekdays[new Date(date).getDay()]}`
}
