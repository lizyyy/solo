export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  
  const parsed = new Date(dateStr)
  if (isNaN(parsed.getTime())) return null
  
  return parsed
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19)
}

export function isDateExpired(dateStr: string): boolean {
  const date = parseDate(dateStr)
  if (!date) return false
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  return date < today
}

export function isDateWithinDays(dateStr: string, days: number): boolean {
  const date = parseDate(dateStr)
  if (!date) return false
  
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() + days)
  targetDate.setHours(23, 59, 59, 999)
  
  return date <= targetDate
}

export function getDaysDifference(dateStr1: string, dateStr2: string): number {
  const date1 = parseDate(dateStr1)
  const date2 = parseDate(dateStr2)
  
  if (!date1 || !date2) return 0
  
  const diffTime = date2.getTime() - date1.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function todayString(): string {
  return formatDate(new Date())
}

export function nowString(): string {
  return formatDateTime(new Date())
}

export function timeOverlaps(
  start1: string, end1: string,
  start2: string, end2: string
): boolean {
  const s1 = parseDate(start1)
  const e1 = parseDate(end1)
  const s2 = parseDate(start2)
  const e2 = parseDate(end2)
  
  if (!s1 || !e1 || !s2 || !e2) return false
  
  return s1 < e2 && s2 < e1
}
