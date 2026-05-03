export function timeToSeconds(timeStr: string, frameRate?: number): number {
  if (timeStr.includes(':')) {
    const match = timeStr.match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/)
    if (match) {
      const hours = parseInt(match[1], 10)
      const minutes = parseInt(match[2], 10)
      const seconds = parseInt(match[3], 10)
      const milliseconds = parseInt(match[4], 10)
      return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
    }
    const simpleMatch = timeStr.match(/^(\d{2}):(\d{2}):(\d{2})$/)
    if (simpleMatch) {
      const hours = parseInt(simpleMatch[1], 10)
      const minutes = parseInt(simpleMatch[2], 10)
      const seconds = parseInt(simpleMatch[3], 10)
      return hours * 3600 + minutes * 60 + seconds
    }
  }

  if (timeStr.includes(';') && frameRate) {
    const match = timeStr.match(/^(\d{2}):(\d{2}):(\d{2});(\d{2})$/)
    if (match) {
      const hours = parseInt(match[1], 10)
      const minutes = parseInt(match[2], 10)
      const seconds = parseInt(match[3], 10)
      const frames = parseInt(match[4], 10)
      return hours * 3600 + minutes * 60 + seconds + frames / frameRate
    }
  }

  const seconds = parseFloat(timeStr)
  if (!isNaN(seconds)) {
    return seconds
  }

  console.warn(`无法解析时间格式: ${timeStr}`)
  return 0
}

export function secondsToTime(seconds: number, useComma: boolean = true): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.round((seconds % 1) * 1000)

  const separator = useComma ? ',' : '.'
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}${separator}${String(milliseconds).padStart(3, '0')}`
}

export function formatTimeDisplay(seconds: number): string {
  return secondsToTime(seconds, false)
}

export function getDuration(start: number, end: number): number {
  return Math.max(0, end - start)
}

export function timeOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): {
  overlaps: boolean
  overlapStart: number
  overlapEnd: number
  overlapDuration: number
} {
  const overlapStart = Math.max(aStart, bStart)
  const overlapEnd = Math.min(aEnd, bEnd)
  const overlapDuration = overlapEnd - overlapStart

  return {
    overlaps: overlapDuration > 0,
    overlapStart,
    overlapEnd,
    overlapDuration: Math.max(0, overlapDuration),
  }
}
