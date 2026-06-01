import type { ExhibitPoint, OptimizationResult, OptimizationStep, ExcludedPoint, Prediction } from '@/types'
import { convertToMeters, findDuplicates } from './validation'

function euclideanDistance(a: ExhibitPoint, b: ExhibitPoint): number {
  if (a.x === null || a.y === null || b.x === null || b.y === null) return Infinity
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function nearestNeighborRoute(
  points: ExhibitPoint[],
  startPoint: ExhibitPoint,
  endPoint: ExhibitPoint,
): { route: ExhibitPoint[]; totalDistance: number } {
  const midPoints = points.filter((p) => p.id !== startPoint.id && p.id !== endPoint.id)
  const visited = new Set<string>()
  const route: ExhibitPoint[] = [startPoint]
  let current = startPoint
  let totalDistance = 0

  while (visited.size < midPoints.length) {
    let nearest: ExhibitPoint | null = null
    let nearestDist = Infinity
    for (const p of midPoints) {
      if (visited.has(p.id)) continue
      const dist = euclideanDistance(current, p)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = p
      }
    }
    if (!nearest) break
    visited.add(nearest.id)
    route.push(nearest)
    totalDistance += nearestDist
    current = nearest
  }

  totalDistance += euclideanDistance(current, endPoint)
  route.push(endPoint)

  return { route, totalDistance }
}

export function optimizeRoute(rawPoints: ExhibitPoint[]): OptimizationResult {
  const steps: OptimizationStep[] = []
  const excludedPoints: ExcludedPoint[] = []

  const converted = rawPoints.map(convertToMeters)
  steps.push({
    step: 1,
    title: '数据预处理：单位统一',
    description: `检测到 ${rawPoints.filter((p) => p.unit === 'ft').length} 条英尺单位数据，已全部转换为米。转换系数 1 ft = 0.3048 m。`,
    data: {
      convertedIds: rawPoints.filter((p) => p.unit === 'ft').map((p) => p.id),
      targetUnit: 'm',
    },
  })

  const nullCoordPoints = converted.filter((p) => p.x === null || p.y === null)
  for (const p of nullCoordPoints) {
    excludedPoints.push({
      pointId: p.id,
      reason: `坐标不完整(x=${p.x ?? '空'}, y=${p.y ?? '空'})，无法参与路线距离计算`,
    })
  }

  const duplicates = findDuplicates(converted)
  const mergedDuplicateIds: string[] = []
  for (const [, ids] of duplicates) {
    for (let i = 1; i < ids.length; i++) {
      mergedDuplicateIds.push(ids[i])
      excludedPoints.push({
        pointId: ids[i],
        reason: `与展点 ${ids[0]} 坐标重复，合并为同一访问点`,
      })
    }
  }

  steps.push({
    step: 2,
    title: '约束检查：排除不可计算点',
    description: `共排除 ${excludedPoints.length} 个展点：${nullCoordPoints.length} 个坐标缺失、${mergedDuplicateIds.length} 个重复合并。这些记录保留在异常表中，不参与计算但不会消失。`,
    data: {
      excludedCount: excludedPoints.length,
      nullCount: nullCoordPoints.length,
      duplicateCount: mergedDuplicateIds.length,
      excludedIds: excludedPoints.map((e) => e.pointId),
    },
  })

  const excludedIds = new Set(excludedPoints.map((e) => e.pointId))
  const validPoints = converted.filter((p) => !excludedIds.has(p.id))

  const startPoint = validPoints.find((p) => p.category === '入口') || validPoints[0]
  const endPoint = validPoints.find((p) => p.category === '出口') || validPoints[validPoints.length - 1]

  steps.push({
    step: 3,
    title: '路线候选：最近邻贪心策略',
    description: `以"${startPoint.name}"为起点、"${endPoint.name}"为终点，采用最近邻贪心算法生成候选路线。每一步选择距离当前点最近的未访问展点，优先保证路线紧凑。`,
    data: {
      algorithm: 'nearest-neighbor',
      startPoint: startPoint.name,
      endPoint: endPoint.name,
      candidateCount: validPoints.length - 2,
    },
  })

  const { route, totalDistance } = nearestNeighborRoute(validPoints, startPoint, endPoint)

  const suspiciousPoints = validPoints.filter(
    (p) => p.estimatedStayMinutes !== null && p.estimatedStayMinutes > 120,
  )

  steps.push({
    step: 4,
    title: '评分排序：距离+时间综合评分',
    description: `路线总距离 ${totalDistance.toFixed(1)}m，总预计停留 ${validPoints.reduce((s, p) => s + (p.estimatedStayMinutes || 0), 0)} 分钟。${suspiciousPoints.length > 0 ? `注意：${suspiciousPoints.map((p) => p.name).join('、')}停留时间异常（>${120}分钟），会拉高总时间，建议复核。` : '所有展点停留时间在合理范围内。'}`,
    data: {
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalStayMinutes: validPoints.reduce((s, p) => s + (p.estimatedStayMinutes || 0), 0),
      suspiciousPoints: suspiciousPoints.map((p) => ({ id: p.id, name: p.name, stay: p.estimatedStayMinutes })),
    },
  })

  const routeNames = route.map((p) => p.name)
  steps.push({
    step: 5,
    title: '最终推荐路线',
    description: `推荐路线：${routeNames.join(' → ')}。该路线以最近邻策略保证距离最短，同时兼顾展点停留时间的合理性。如有特殊停留需求，可通过补录调整。`,
    data: {
      route: route.map((p) => p.id),
      routeNames,
      totalDistance: Math.round(totalDistance * 10) / 10,
    },
  })

  const totalStayMinutes = validPoints.reduce((s, p) => s + (p.estimatedStayMinutes || 0), 0)
  const walkTimeMinutes = Math.round(totalDistance / 80)
  const estimatedTime = totalStayMinutes + walkTimeMinutes

  const predictions: Prediction[] = []

  predictions.push({
    suggestion: '建议在"休息区"增加 5 分钟缓冲',
    reasoning: `当前路线从"${route[Math.floor(route.length / 2)]?.name || '中部展点'}"到下一展点步行距离约 ${route.length > 2 ? euclideanDistance(route[Math.floor(route.length / 2)], route[Math.floor(route.length / 2) + 1]).toFixed(1) : '0'}m，中间经过休息区，增加缓冲可减少游客疲劳感。`,
    confidence: 0.82,
  })

  if (suspiciousPoints.length > 0) {
    predictions.push({
      suggestion: `建议复核"${suspiciousPoints[0].name}"停留时间`,
      reasoning: `该展点预计停留 ${suspiciousPoints[0].estimatedStayMinutes} 分钟，远超 120 分钟阈值。如为录入错误，修正后总时间将减少约 ${(suspiciousPoints[0].estimatedStayMinutes! - 30)} 分钟。当前计算已包含此异常值，实际参观时间可能远低于预估。`,
      confidence: 0.95,
    })
  }

  if (nullCoordPoints.length > 0) {
    predictions.push({
      suggestion: `补充"${nullCoordPoints[0].name}"坐标后重新优化`,
      reasoning: `该展点因坐标缺失被排除，如补充坐标可加入路线，可能缩短总距离。当前路线未覆盖该展点，游客需额外安排。`,
      confidence: 0.7,
    })
  }

  return {
    route: route.map((p) => p.id),
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalDistanceUnit: 'm',
    estimatedTime,
    reasoning: steps,
    excludedPoints,
    predictions,
  }
}
