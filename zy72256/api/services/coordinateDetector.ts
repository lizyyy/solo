import type { CoordinateType } from '../../shared/types.js'

export function detectCoordinateType(description: string): CoordinateType {
  const hasLongitudeLatitude = checkLongitudeLatitude(description)
  const hasMetric = checkMetric(description)

  if (hasLongitudeLatitude && hasMetric) return 'mixed'
  if (hasLongitudeLatitude) return 'longitude_latitude'
  if (hasMetric) return 'metric'
  return 'metric'
}

function checkLongitudeLatitude(text: string): boolean {
  if (/[EWWNSNS][\s\d]/.test(text)) return true
  if (/[东西]经|[南北]纬/.test(text)) return true
  if (/\d+\.?\d*\s*°/.test(text)) return true
  const degreeMatches = text.match(/(\d+\.?\d*)\s*°/g)
  if (degreeMatches) {
    for (const m of degreeMatches) {
      const num = parseFloat(m)
      if (num >= -90 && num <= 180) return true
    }
  }
  return false
}

function checkMetric(text: string): boolean {
  if (/m|米/.test(text)) return true
  const numberMatches = text.match(/(\d+\.?\d*)/g)
  if (numberMatches) {
    for (const m of numberMatches) {
      const num = parseFloat(m)
      if (num > 1000 && !/\d+\.?\d*\s*°/.test(text)) return true
    }
  }
  return false
}

export function parseCoordinates(description: string): {
  raw_latitude: number | null
  raw_longitude: number | null
  raw_metric_x: number | null
  raw_metric_y: number | null
} {
  const result = {
    raw_latitude: null as number | null,
    raw_longitude: null as number | null,
    raw_metric_x: null as number | null,
    raw_metric_y: null as number | null,
  }

  const latMatch = description.match(/[NS南北纬]\s*(\d+\.?\d*)/)
  if (latMatch) result.raw_latitude = parseFloat(latMatch[1])

  const lngMatch = description.match(/[EW东西经]\s*(\d+\.?\d*)/)
  if (lngMatch) result.raw_longitude = parseFloat(lngMatch[1])

  const degreeMatches = description.match(/(\d+\.?\d*)\s*°/g)
  if (degreeMatches && !latMatch && !lngMatch) {
    const nums = degreeMatches.map(m => parseFloat(m))
    if (nums.length >= 2) {
      result.raw_latitude = nums[0]
      result.raw_longitude = nums[1]
    } else if (nums.length === 1) {
      result.raw_latitude = nums[0]
    }
  }

  const metricPattern = /(\d+\.?\d*)\s*[m米]/
  const metricMatches = description.match(metricPattern)
  if (metricMatches) {
    const allNumbers = description.match(/(\d+\.?\d*)/g)
    if (allNumbers) {
      const metricNums = allNumbers.map(Number).filter(n => n > 1000)
      if (metricNums.length >= 2) {
        result.raw_metric_x = metricNums[0]
        result.raw_metric_y = metricNums[1]
      } else if (metricNums.length === 1) {
        result.raw_metric_x = metricNums[0]
      }
    }
  }

  if (result.raw_metric_x === null && result.raw_metric_y === null) {
    const allNumbers = description.match(/(\d+\.?\d*)/g)
    if (allNumbers) {
      const bigNums = allNumbers.map(Number).filter(n => n > 1000)
      if (bigNums.length >= 2) {
        result.raw_metric_x = bigNums[0]
        result.raw_metric_y = bigNums[1]
      } else if (bigNums.length === 1) {
        result.raw_metric_x = bigNums[0]
      }
    }
  }

  return result
}
