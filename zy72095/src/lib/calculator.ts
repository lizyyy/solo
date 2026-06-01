import { IntersectionData, SpeedBandResult, OptimizationSuggestion } from "./types"

export function calculateOverallBandwidth(data: IntersectionData[]): number {
  if (data.length === 0) return 0
  return Math.min(...data.map((d) => d.cycle * d.greenRatio))
}

export function calculateSpeedBand(data: IntersectionData[]): SpeedBandResult[] {
  if (data.length < 2) return []

  const bandwidth = calculateOverallBandwidth(data)
  const results: SpeedBandResult[] = []

  for (let i = 0; i < data.length - 1; i++) {
    const from = data[i]
    const to = data[i + 1]
    const distance = to.distanceFromStart - from.distanceFromStart
    const deltaOffset = to.offset - from.offset
    const greenTimeFrom = from.cycle * from.greenRatio
    const greenTimeTo = to.cycle * to.greenRatio
    const segmentBandwidth = Math.min(greenTimeFrom, greenTimeTo)

    if (segmentBandwidth <= 0) {
      results.push({
        segmentIndex: i,
        fromIntersection: from.name,
        toIntersection: to.name,
        distance,
        speedMin: 0,
        speedMax: 0,
        bandwidth: 0,
        isAnomalous: true,
        anomalyReason: "绿信比为0导致无绿波带宽",
      })
      continue
    }

    if (deltaOffset <= 0) {
      results.push({
        segmentIndex: i,
        fromIntersection: from.name,
        toIntersection: to.name,
        distance,
        speedMin: 0,
        speedMax: 0,
        bandwidth: segmentBandwidth,
        isAnomalous: true,
        anomalyReason: "偏移差≤0，无法形成绿波",
      })
      continue
    }

    const halfBand = bandwidth / 2
    const denominatorMax = deltaOffset - halfBand
    const denominatorMin = deltaOffset + halfBand

    if (denominatorMax <= 0) {
      results.push({
        segmentIndex: i,
        fromIntersection: from.name,
        toIntersection: to.name,
        distance,
        speedMin: 0,
        speedMax: 0,
        bandwidth: segmentBandwidth,
        isAnomalous: true,
        anomalyReason: "偏移差不足以支撑绿波带宽",
      })
      continue
    }

    const speedMax = (distance / denominatorMax) * 3.6
    const speedMin = (distance / denominatorMin) * 3.6

    results.push({
      segmentIndex: i,
      fromIntersection: from.name,
      toIntersection: to.name,
      distance,
      speedMin: Math.round(speedMin * 10) / 10,
      speedMax: Math.round(speedMax * 10) / 10,
      bandwidth: Math.round(segmentBandwidth * 10) / 10,
      isAnomalous: false,
    })
  }

  return results
}

export function calculateOptimizations(
  data: IntersectionData[],
  results: SpeedBandResult[]
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []
  const currentBandwidth = calculateOverallBandwidth(data)

  const offsetDeltas = [5, -5, 10, -10]
  const greenRatioDeltas = [0.05, -0.05, 0.1, -0.1]

  for (let i = 1; i < data.length; i++) {
    const intersection = data[i]
    const bestOffsetSuggestion = tryOffsetOptimization(
      data, i, offsetDeltas, currentBandwidth
    )
    if (bestOffsetSuggestion) {
      suggestions.push(bestOffsetSuggestion)
      continue
    }

    const bestGreenSuggestion = tryGreenRatioOptimization(
      data, i, greenRatioDeltas, currentBandwidth
    )
    if (bestGreenSuggestion) {
      suggestions.push(bestGreenSuggestion)
    }
  }

  return suggestions
}

function tryOffsetOptimization(
  data: IntersectionData[],
  index: number,
  deltas: number[],
  currentBandwidth: number
): OptimizationSuggestion | null {
  let bestSuggestion: OptimizationSuggestion | null = null
  let bestImprovement = 0

  for (const delta of deltas) {
    const adjusted = data.map((d, i) =>
      i === index ? { ...d, offset: d.offset + delta } : d
    )

    if (adjusted[index].offset < 0) continue

    const newBandwidth = calculateOverallBandwidth(adjusted)
    const improvement = newBandwidth - currentBandwidth

    if (improvement > currentBandwidth * 0.1 && improvement > bestImprovement) {
      bestImprovement = improvement
      const segBefore = index > 0 ? index - 1 : -1
      const segAfter = index < data.length - 1 ? index : -1

      let reasonParts: string[] = []
      reasonParts.push(
        `将${data[index].id}路口偏移量从${data[index].offset}s调整为${adjusted[index].offset}s`
      )

      if (segBefore >= 0) {
        const oldDelta = data[index].offset - data[segBefore].offset
        const newDelta = adjusted[index].offset - adjusted[segBefore].offset
        reasonParts.push(
          `因为${data[segBefore].id}-${data[index].id}段偏移差为${oldDelta}s，调整后为${newDelta}s`
        )
      }

      reasonParts.push(`调整后带宽增加${Math.round(improvement * 10) / 10}s`)

      bestSuggestion = {
        intersectionId: data[index].id,
        intersectionName: data[index].name,
        field: "offset",
        currentValue: data[index].offset,
        suggestedValue: adjusted[index].offset,
        reason: reasonParts.join("，"),
        impactOnBandwidth: Math.round(improvement * 10) / 10,
      }
    }
  }

  return bestSuggestion
}

function tryGreenRatioOptimization(
  data: IntersectionData[],
  index: number,
  deltas: number[],
  currentBandwidth: number
): OptimizationSuggestion | null {
  let bestSuggestion: OptimizationSuggestion | null = null
  let bestImprovement = 0

  for (const delta of deltas) {
    const newGreenRatio = data[index].greenRatio + delta
    if (newGreenRatio <= 0 || newGreenRatio >= 1) continue

    const adjusted = data.map((d, i) =>
      i === index ? { ...d, greenRatio: newGreenRatio } : d
    )

    const newBandwidth = calculateOverallBandwidth(adjusted)
    const improvement = newBandwidth - currentBandwidth

    if (improvement > currentBandwidth * 0.1 && improvement > bestImprovement) {
      bestImprovement = improvement

      bestSuggestion = {
        intersectionId: data[index].id,
        intersectionName: data[index].name,
        field: "greenRatio",
        currentValue: data[index].greenRatio,
        suggestedValue: Math.round(newGreenRatio * 100) / 100,
        reason: `将${data[index].id}路口绿信比从${data[index].greenRatio}调整为${Math.round(newGreenRatio * 100) / 100}，因为该路口绿信比过低导致全段带宽受限，调整后带宽增加${Math.round(improvement * 10) / 10}s`,
        impactOnBandwidth: Math.round(improvement * 10) / 10,
      }
    }
  }

  return bestSuggestion
}
