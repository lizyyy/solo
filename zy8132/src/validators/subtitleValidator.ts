import { Subtitle, AudioMarker, ProgramSegment, ValidationIssue } from '../types'
import { timeOverlap, formatTimeDisplay } from '../utils/timeUtils'

interface ValidationOptions {
  silenceThreshold?: number
  gapThreshold?: number
  frameRate?: number
}

const DEFAULT_OPTIONS: ValidationOptions = {
  silenceThreshold: 0.1,
  gapThreshold: 0.5,
  frameRate: 25,
}

export function validateSubtitles(
  subtitles: Subtitle[],
  audioMarkers: AudioMarker[],
  programSegments: ProgramSegment[],
  options: ValidationOptions = DEFAULT_OPTIONS
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const opts = { ...DEFAULT_OPTIONS, ...options }

  for (const subtitle of subtitles) {
    issues.push(...checkSilenceOverlap(subtitle, audioMarkers, opts))
    issues.push(...checkSubtitleOverlap(subtitle, subtitles, opts))
    issues.push(...checkCrossSegment(subtitle, programSegments, opts))
    issues.push(...checkTimeGap(subtitle, subtitles, opts))
  }

  return deduplicateIssues(issues)
}

function checkSilenceOverlap(
  subtitle: Subtitle,
  audioMarkers: AudioMarker[],
  options: ValidationOptions
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const silenceMarkers = audioMarkers.filter(m => m.type === 'silence')

  for (const marker of silenceMarkers) {
    const overlap = timeOverlap(subtitle.startTime, subtitle.endTime, marker.startTime, marker.endTime)
    
    if (overlap.overlaps && overlap.overlapDuration > options.silenceThreshold!) {
      if (overlap.overlapStart === subtitle.startTime && overlap.overlapDuration < (subtitle.endTime - subtitle.startTime) * 0.5) {
        issues.push({
          id: `issue-${subtitle.id}-start-silence`,
          subtitleId: subtitle.id,
          type: 'start_in_silence',
          severity: 'warning',
          message: `字幕开始时间 ${formatTimeDisplay(subtitle.startTime)} 落在静音区间内`,
          suggestion: `建议将开始时间调整到 ${formatTimeDisplay(marker.endTime)} 之后`,
          details: {
            startTime: marker.startTime,
            endTime: marker.endTime,
          },
        })
      } else if (overlap.overlapEnd === subtitle.endTime && overlap.overlapDuration < (subtitle.endTime - subtitle.startTime) * 0.5) {
        issues.push({
          id: `issue-${subtitle.id}-end-silence`,
          subtitleId: subtitle.id,
          type: 'end_in_silence',
          severity: 'warning',
          message: `字幕结束时间 ${formatTimeDisplay(subtitle.endTime)} 落在静音区间内`,
          suggestion: `建议将结束时间调整到 ${formatTimeDisplay(marker.startTime)} 之前`,
          details: {
            startTime: marker.startTime,
            endTime: marker.endTime,
          },
        })
      } else {
        issues.push({
          id: `issue-${subtitle.id}-silence-overlap`,
          subtitleId: subtitle.id,
          type: 'overlap_with_silence',
          severity: 'error',
          message: `字幕与静音区间重叠 ${overlap.overlapDuration.toFixed(3)} 秒`,
          suggestion: `字幕时间: ${formatTimeDisplay(subtitle.startTime)} - ${formatTimeDisplay(subtitle.endTime)}, 静音区间: ${formatTimeDisplay(marker.startTime)} - ${formatTimeDisplay(marker.endTime)}`,
          details: {
            startTime: overlap.overlapStart,
            endTime: overlap.overlapEnd,
            relatedId: marker.id,
          },
        })
      }
    }
  }

  return issues
}

function checkSubtitleOverlap(
  subtitle: Subtitle,
  allSubtitles: Subtitle[],
  _options: ValidationOptions
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const other of allSubtitles) {
    if (other.id === subtitle.id || other.index >= subtitle.index) continue

    const overlap = timeOverlap(subtitle.startTime, subtitle.endTime, other.startTime, other.endTime)
    
    if (overlap.overlaps) {
      issues.push({
        id: `issue-${subtitle.id}-overlap-${other.id}`,
        subtitleId: subtitle.id,
        type: 'overlap_between_subtitles',
        severity: 'error',
        message: `字幕 #${subtitle.index} 与 #${other.index} 重叠 ${overlap.overlapDuration.toFixed(3)} 秒`,
        suggestion: `建议调整其中一个字幕的时间，避免重叠`,
        details: {
          startTime: overlap.overlapStart,
          endTime: overlap.overlapEnd,
          relatedId: other.id,
        },
      })
    }
  }

  return issues
}

function checkCrossSegment(
  subtitle: Subtitle,
  segments: ProgramSegment[],
  _options: ValidationOptions
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  
  if (segments.length === 0) return issues

  const containedSegments = segments.filter(
    s => subtitle.startTime >= s.startTime && subtitle.endTime <= s.endTime
  )

  if (containedSegments.length === 0) {
    const overlappingSegments = segments.filter(s => 
      timeOverlap(subtitle.startTime, subtitle.endTime, s.startTime, s.endTime).overlaps
    )

    if (overlappingSegments.length > 1) {
      const segmentNames = overlappingSegments.map(s => s.name).join('、')
      issues.push({
        id: `issue-${subtitle.id}-cross-segment`,
        subtitleId: subtitle.id,
        type: 'cross_segment',
        severity: 'warning',
        message: `字幕跨越多段: ${segmentNames}`,
        suggestion: `建议将字幕拆分到各自的段落中`,
        details: {
          startTime: subtitle.startTime,
          endTime: subtitle.endTime,
        },
      })
    } else if (overlappingSegments.length === 1) {
      const segment = overlappingSegments[0]
      issues.push({
        id: `issue-${subtitle.id}-partial-segment`,
        subtitleId: subtitle.id,
        type: 'cross_segment',
        severity: 'info',
        message: `字幕部分位于段落 "${segment.name}" 之外`,
        suggestion: `字幕时间: ${formatTimeDisplay(subtitle.startTime)} - ${formatTimeDisplay(subtitle.endTime)}, 段落: ${formatTimeDisplay(segment.startTime)} - ${formatTimeDisplay(segment.endTime)}`,
        details: {
          startTime: segment.startTime,
          endTime: segment.endTime,
          relatedId: segment.id,
        },
      })
    }
  }

  return issues
}

function checkTimeGap(
  subtitle: Subtitle,
  allSubtitles: Subtitle[],
  options: ValidationOptions
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const sortedSubtitles = [...allSubtitles].sort((a, b) => a.index - b.index)
  
  const currentIndex = sortedSubtitles.findIndex(s => s.id === subtitle.id)
  if (currentIndex === -1) return issues

  if (currentIndex > 0) {
    const previous = sortedSubtitles[currentIndex - 1]
    const gap = subtitle.startTime - previous.endTime
    
    if (gap > options.gapThreshold!) {
      issues.push({
        id: `issue-${subtitle.id}-gap-prev`,
        subtitleId: subtitle.id,
        type: 'time_gap',
        severity: 'info',
        message: `与前一条字幕之间有 ${gap.toFixed(3)} 秒的间隔`,
        suggestion: `如果是连续对话，可能需要检查时间`,
        details: {
          startTime: previous.endTime,
          endTime: subtitle.startTime,
          relatedId: previous.id,
        },
      })
    }
  }

  return issues
}

function deduplicateIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>()
  return issues.filter(issue => {
    const key = `${issue.subtitleId}-${issue.type}-${issue.details?.relatedId || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function getIssuesForSubtitle(
  subtitleId: string,
  issues: ValidationIssue[]
): ValidationIssue[] {
  return issues.filter(i => i.subtitleId === subtitleId)
}

export function getIssueStats(issues: ValidationIssue[]): {
  errors: number
  warnings: number
  infos: number
  byType: Record<string, number>
} {
  const byType: Record<string, number> = {}
  let errors = 0
  let warnings = 0
  let infos = 0

  for (const issue of issues) {
    byType[issue.type] = (byType[issue.type] || 0) + 1
    
    if (issue.severity === 'error') errors++
    else if (issue.severity === 'warning') warnings++
    else infos++
  }

  return { errors, warnings, infos, byType }
}
