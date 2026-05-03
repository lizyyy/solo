import Papa from 'papaparse'
import { AudioMarker } from '../types'
import { timeToSeconds } from '../utils/timeUtils'

interface AudioMarkerRow {
  id?: string
  start_time?: string
  end_time?: string
  startTime?: string
  endTime?: string
  type?: string
  confidence?: string
}

export function parseAudioMarkersCSV(content: string, frameRate: number = 25): AudioMarker[] {
  const result = Papa.parse<AudioMarkerRow>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (result.errors.length > 0) {
    console.warn('CSV解析警告:', result.errors)
  }

  const markers: AudioMarker[] = []

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i]
    
    const startTimeStr = row.start_time || row.startTime || row['开始时间'] || ''
    const endTimeStr = row.end_time || row.endTime || row['结束时间'] || ''
    const typeStr = (row.type || '').toLowerCase()
    
    let type: 'speech' | 'silence' = 'speech'
    if (typeStr.includes('silence') || typeStr.includes('静音') || typeStr.includes('non-speech')) {
      type = 'silence'
    } else if (typeStr.includes('speech') || typeStr.includes('说话') || typeStr.includes('voice')) {
      type = 'speech'
    }

    const startTime = timeToSeconds(startTimeStr, frameRate)
    const endTime = timeToSeconds(endTimeStr, frameRate)

    markers.push({
      id: row.id || `marker-${i}`,
      startTime,
      endTime,
      type,
      confidence: row.confidence ? parseFloat(row.confidence) : undefined,
    })
  }

  return markers.sort((a, b) => a.startTime - b.startTime)
}
