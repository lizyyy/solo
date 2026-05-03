import { Subtitle } from '../types'
import { timeToSeconds } from '../utils/timeUtils'

export function parseSRT(content: string): Subtitle[] {
  const subtitles: Subtitle[] = []
  
  const blocks = content
    .replace(/\r\n/g, '\n')
    .split(/\n\n+/)
    .filter(block => block.trim().length > 0)

  for (const block of blocks) {
    const lines = block.split('\n').filter(line => line.trim().length > 0)
    if (lines.length < 3) continue

    const indexLine = lines[0]
    const timeLine = lines[1]
    const textLines = lines.slice(2)

    const index = parseInt(indexLine.trim(), 10)
    if (isNaN(index)) continue

    const timeMatch = timeLine.match(/^(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/)
    if (!timeMatch) continue

    const startTime = timeToSeconds(timeMatch[1])
    const endTime = timeToSeconds(timeMatch[2])
    const text = textLines.join('\n').trim()

    subtitles.push({
      id: `subtitle-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      index,
      startTime,
      endTime,
      text,
      originalStartTime: startTime,
      originalEndTime: endTime,
      isModified: false,
    })
  }

  return subtitles.sort((a, b) => a.startTime - b.startTime)
}

export function generateSRT(subtitles: Subtitle[]): string {
  const sortedSubtitles = [...subtitles].sort((a, b) => a.startTime - b.startTime)
  
  return sortedSubtitles.map((sub, index) => {
    const timeCodeStart = formatSRTTime(sub.startTime)
    const timeCodeEnd = formatSRTTime(sub.endTime)
    
    return `${index + 1}\n${timeCodeStart} --> ${timeCodeEnd}\n${sub.text}\n`
  }).join('\n')
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.round((seconds % 1) * 1000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`
}
