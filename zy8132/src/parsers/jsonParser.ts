import { ProgramSegment } from '../types'
import { timeToSeconds } from '../utils/timeUtils'

interface RawSegment {
  id?: string
  name?: string
  startTime?: string | number
  endTime?: string | number
  start_time?: string | number
  end_time?: string | number
  segmentType?: string
  segment_type?: string
  type?: string
  metadata?: Record<string, unknown>
}

export function parseProgramSegmentsJSON(content: string, frameRate: number = 25): ProgramSegment[] {
  let data: RawSegment[] | { segments: RawSegment[] }
  
  try {
    data = JSON.parse(content)
  } catch (e) {
    console.error('JSON解析失败:', e)
    return []
  }

  const segments: RawSegment[] = Array.isArray(data) ? data : (data.segments || [])

  return segments
    .map((segment, index) => {
      const startTimeVal = segment.startTime ?? segment.start_time
      const endTimeVal = segment.endTime ?? segment.end_time
      
      let startTime = 0
      let endTime = 0

      if (typeof startTimeVal === 'number') {
        startTime = startTimeVal
      } else if (typeof startTimeVal === 'string') {
        startTime = timeToSeconds(startTimeVal, frameRate)
      }

      if (typeof endTimeVal === 'number') {
        endTime = endTimeVal
      } else if (typeof endTimeVal === 'string') {
        endTime = timeToSeconds(endTimeVal, frameRate)
      }

      const segmentType = segment.segmentType ?? segment.segment_type ?? segment.type ?? 'unknown'

      return {
        id: segment.id || `segment-${index}`,
        name: segment.name || `段落 ${index + 1}`,
        startTime,
        endTime,
        segmentType,
        metadata: segment.metadata,
      }
    })
    .sort((a, b) => a.startTime - b.startTime)
}
