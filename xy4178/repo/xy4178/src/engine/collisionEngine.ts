import { v4 as uuidv4 } from 'uuid'
import {
  Segment,
  Crane,
  Obstacle,
  TidalWindow,
  Keyframe,
  CollisionResult,
  CollisionType,
  CollisionSeverity,
  Vector3D
} from '@/types'
import { vec3, clamp, interpolateLinear, boxBoxIntersection } from '@/utils/math'

export interface EngineConfig {
  safetyMargin: number
  tidalHeightThreshold: number
  gravityTolerance: number
}

const defaultConfig: EngineConfig = {
  safetyMargin: 1.0,
  tidalHeightThreshold: 0.5,
  gravityTolerance: 0.1
}

export class CollisionEngine {
  private config: EngineConfig

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  public checkAll(
    segment: Segment,
    crane: Crane,
    obstacles: Obstacle[],
    tidalWindows: TidalWindow[],
    currentPosition: Vector3D,
    currentRotation: Vector3D,
    keyframe: Keyframe,
    currentTime?: Date
  ): CollisionResult[] {
    const results: CollisionResult[] = []

    results.push(...this.checkRadius(crane, currentPosition, segment))
    results.push(...this.checkCapacity(crane, keyframe.radius, segment.weight))
    results.push(...this.checkClearance(segment, currentPosition, obstacles, tidalWindows, currentTime))
    results.push(...this.checkGravityOffset(segment, currentRotation))
    results.push(...this.checkTidalWindow(tidalWindows, currentTime, segment))
    results.push(...this.checkObstacleCollision(segment, currentPosition, obstacles))
    results.push(...this.checkBoomSweep(crane, segment, currentPosition, obstacles))
    results.push(...this.checkTransportRoute(segment, currentPosition, obstacles))

    return results
  }

  private checkRadius(
    crane: Crane,
    segmentPosition: Vector3D,
    segment: Segment
  ): CollisionResult[] {
    const results: CollisionResult[] = []
    const radius = vec3.distance2D(crane.position, segmentPosition)

    if (radius > crane.maxRadius) {
      results.push({
        id: uuidv4(),
        type: 'radius_violation',
        severity: 'critical',
        message: `分段"${segment.name}"超出吊车最大吊装半径 ${radius.toFixed(1)}m > ${crane.maxRadius}m`,
        position: segmentPosition,
        involvedObjects: [segment.id, crane.id],
        distance: radius - crane.maxRadius,
        recommendedAction: '请缩短吊装半径或更换更大范围的吊车'
      })
    }

    if (radius < crane.minRadius) {
      results.push({
        id: uuidv4(),
        type: 'radius_violation',
        severity: 'warning',
        message: `分段"${segment.name}"小于吊车最小吊装半径 ${radius.toFixed(1)}m < ${crane.minRadius}m`,
        position: segmentPosition,
        involvedObjects: [segment.id, crane.id],
        distance: crane.minRadius - radius,
        recommendedAction: '注意吊臂可能与吊车结构干涉'
      })
    }

    return results
  }

  private checkCapacity(
    crane: Crane,
    currentRadius: number,
    segmentWeight: number
  ): CollisionResult[] {
    const results: CollisionResult[] = []
    
    const capacity = this.getCapacityAtRadius(crane, currentRadius)
    
    if (segmentWeight > capacity) {
      results.push({
        id: uuidv4(),
        type: 'capacity_violation',
        severity: 'critical',
        message: `分段重量 ${segmentWeight}t 超出当前半径 ${currentRadius}m 下的起重量 ${capacity}t`,
        involvedObjects: [],
        distance: segmentWeight - capacity,
        recommendedAction: '请减少分段重量或缩短吊装半径'
      })
    } else if (segmentWeight > capacity * 0.9) {
      results.push({
        id: uuidv4(),
        type: 'capacity_violation',
        severity: 'warning',
        message: `分段重量 ${segmentWeight}t 接近当前半径下的起重量极限 ${capacity}t`,
        involvedObjects: [],
        distance: capacity - segmentWeight,
        recommendedAction: '请确认起重量并考虑安全裕度'
      })
    }

    return results
  }

  private getCapacityAtRadius(crane: Crane, radius: number): number {
    const curve = crane.capacityCurve
    if (curve.length === 0) return crane.maxLiftCapacity
    if (curve.length === 1) return curve[0].capacity

    let prevPoint = curve[0]
    let nextPoint = curve[curve.length - 1]

    for (let i = 0; i < curve.length - 1; i++) {
      if (radius >= curve[i].radius && radius <= curve[i + 1].radius) {
        prevPoint = curve[i]
        nextPoint = curve[i + 1]
        break
      }
    }

    if (prevPoint === nextPoint) return prevPoint.capacity

    const t = (radius - prevPoint.radius) / (nextPoint.radius - prevPoint.radius)
    return interpolateLinear(t, [prevPoint.capacity, nextPoint.capacity])
  }

  private checkClearance(
    segment: Segment,
    position: Vector3D,
    obstacles: Obstacle[],
    tidalWindows: TidalWindow[],
    currentTime?: Date
  ): CollisionResult[] {
    const results: CollisionResult[] = []
    
    const currentHeight = position.y + segment.dimensions.height / 2
    
    let minRequiredHeight = this.config.safetyMargin
    if (currentTime && tidalWindows.length > 0) {
      const activeWindow = tidalWindows.find(
        w => currentTime >= w.startTime && currentTime <= w.endTime
      )
      if (activeWindow) {
        minRequiredHeight = activeWindow.minHeight + activeWindow.safeClearance
      }
    }

    const minHeightFromObstacles = obstacles
      .filter(o => o.type === 'existing_structure')
      .map(o => o.position.y + o.dimensions.height + this.config.safetyMargin)
    
    if (minHeightFromObstacles.length > 0) {
      minRequiredHeight = Math.max(minRequiredHeight, ...minHeightFromObstacles)
    }

    if (currentHeight < minRequiredHeight) {
      results.push({
        id: uuidv4(),
        type: 'clearance_violation',
        severity: 'critical',
        message: `分段"${segment.name}"净空不足 当前高度 ${currentHeight.toFixed(1)}m < 所需 ${minRequiredHeight}m`,
        position,
        involvedObjects: [segment.id],
        distance: minRequiredHeight - currentHeight,
        recommendedAction: '请提高分段吊装高度或等待合适的潮位窗口'
      })
    }

    return results
  }

  private checkGravityOffset(
    segment: Segment,
    rotation: Vector3D
  ): CollisionResult[] {
    const results: CollisionResult[] = []
    
    const cog = segment.centerOfGravity
    
    const maxOffsetX = segment.dimensions.length * this.config.gravityTolerance
    const maxOffsetZ = segment.dimensions.width * this.config.gravityTolerance
    
    if (Math.abs(cog.x) > maxOffsetX || Math.abs(cog.z) > maxOffsetZ) {
      results.push({
        id: uuidv4(),
        type: 'gravity_offset',
        severity: 'warning',
        message: `分段"${segment.name}"重心偏移可能导致倾覆风险 X:${cog.x.toFixed(2)}m Z:${cog.z.toFixed(2)}m`,
        involvedObjects: [segment.id],
        distance: Math.sqrt(cog.x * cog.x + cog.z * cog.z),
        recommendedAction: '请调整吊点位置以平衡重心'
      })
    }

    if (Math.abs(rotation.x) > 5 || Math.abs(rotation.z) > 5) {
      results.push({
        id: uuidv4(),
        type: 'gravity_offset',
        severity: 'warning',
        message: `分段"${segment.name}"倾斜角度过大 Roll:${rotation.x.toFixed(1)}° Pitch:${rotation.z.toFixed(1)}°`,
        involvedObjects: [segment.id],
        recommendedAction: '请调整吊索长度使分段保持水平'
      })
    }

    return results
  }

  private checkTidalWindow(
    tidalWindows: TidalWindow[],
    currentTime?: Date,
    segment?: Segment
  ): CollisionResult[] {
    const results: CollisionResult[] = []
    
    if (tidalWindows.length === 0) {
      results.push({
        id: uuidv4(),
        type: 'tidal_window',
        severity: 'info',
        message: '未配置潮位窗口，请手动确认吊装时机',
        involvedObjects: [],
        recommendedAction: '导入潮位数据或确认吊装时间'
      })
      return results
    }

    if (!currentTime) {
      const now = new Date()
      const activeNow = tidalWindows.find(
        w => now >= w.startTime && now <= w.endTime
      )

      if (!activeNow) {
        const nextWindow = tidalWindows.find(w => w.startTime > now)
        results.push({
          id: uuidv4(),
          type: 'tidal_window',
          severity: 'warning',
          message: nextWindow 
            ? `当前不在潮位窗口内，下一个窗口: ${nextWindow.startTime.toLocaleString()}`
            : '当前不在任何潮位窗口内',
          involvedObjects: [],
          recommendedAction: '请等待合适的潮位窗口'
        })
      }
      return results
    }

    const activeWindow = tidalWindows.find(
      w => currentTime >= w.startTime && currentTime <= w.endTime
    )

    if (!activeWindow) {
      results.push({
        id: uuidv4(),
        type: 'tidal_window',
        severity: 'critical',
        message: `关键帧时间 ${currentTime.toLocaleString()} 不在任何潮位窗口内`,
        involvedObjects: segment ? [segment.id] : [],
        recommendedAction: '请调整关键帧时间到潮位窗口内'
      })
    }

    return results
  }

  private checkObstacleCollision(
    segment: Segment,
    position: Vector3D,
    obstacles: Obstacle[]
  ): CollisionResult[] {
    const results: CollisionResult[] = []
    
    const segmentBox = {
      center: position,
      dimensions: {
        length: segment.dimensions.length + this.config.safetyMargin * 2,
        width: segment.dimensions.width + this.config.safetyMargin * 2,
        height: segment.dimensions.height + this.config.safetyMargin * 2
      }
    }

    for (const obstacle of obstacles) {
      const obstacleBox = {
        center: obstacle.position,
        dimensions: obstacle.dimensions
      }

      if (boxBoxIntersection(segmentBox, obstacleBox)) {
        const distance = vec3.distance(position, obstacle.position)
        const severity: CollisionSeverity = distance < 2 ? 'critical' : 'warning'
        
        results.push({
          id: uuidv4(),
          type: 'obstacle_collision',
          severity,
          message: `分段"${segment.name}"与障碍物"${obstacle.name}"距离过近 ${distance.toFixed(1)}m`,
          position,
          involvedObjects: [segment.id, obstacle.id],
          distance,
          recommendedAction: obstacle.type === 'temporary_support'
            ? '考虑移除临时支架或调整吊装路径'
            : '请调整吊装路径以避开障碍物'
        })
      }
    }

    return results
  }

  private checkBoomSweep(
    crane: Crane,
    segment: Segment,
    position: Vector3D,
    obstacles: Obstacle[]
  ): CollisionResult[] {
    const results: CollisionResult[] = []
    
    const radius = vec3.distance2D(crane.position, position)
    const height = position.y + segment.dimensions.height / 2
    
    for (const obstacle of obstacles) {
      const obstacleRadius = vec3.distance2D(crane.position, obstacle.position)
      
      if (Math.abs(obstacleRadius - radius) < 5) {
        const obstacleTop = obstacle.position.y + obstacle.dimensions.height
        
        if (height < obstacleTop + this.config.safetyMargin) {
          results.push({
            id: uuidv4(),
            type: 'boom_sweep',
            severity: 'critical',
            message: `吊臂扫掠路径可能与"${obstacle.name}"干涉 吊臂高度:${height.toFixed(1)}m 障碍物高度:${obstacleTop.toFixed(1)}m`,
            position,
            involvedObjects: [crane.id, obstacle.id],
            distance: obstacleTop - height,
            recommendedAction: '请提高吊臂高度或调整吊装半径'
          })
        }
      }
    }

    return results
  }

  private checkTransportRoute(
    segment: Segment,
    position: Vector3D,
    obstacles: Obstacle[]
  ): CollisionResult[] {
    const results: CollisionResult[] = []
    
    const transportObstacles = obstacles.filter(o => o.type === 'transport_route')
    
    for (const route of transportObstacles) {
      const inRoute = this.isPositionInRoute(position, segment, route)
      
      if (inRoute) {
        results.push({
          id: uuidv4(),
          type: 'transport_blocked',
          severity: 'warning',
          message: `分段"${segment.name}"位于转运路线"${route.name}"区域内`,
          position,
          involvedObjects: [segment.id, route.id],
          recommendedAction: '请确认转运路线是否可用，或选择其他吊装时机'
        })
      }
    }

    return results
  }

  private isPositionInRoute(
    position: Vector3D,
    segment: Segment,
    route: Obstacle
  ): boolean {
    const halfSegmentLength = segment.dimensions.length / 2
    const halfSegmentWidth = segment.dimensions.width / 2
    const halfRouteLength = route.dimensions.length / 2
    const halfRouteWidth = route.dimensions.width / 2

    const overlapX = 
      position.x - halfSegmentLength < route.position.x + halfRouteLength &&
      position.x + halfSegmentLength > route.position.x - halfRouteLength
    
    const overlapZ = 
      position.z - halfSegmentWidth < route.position.z + halfRouteWidth &&
      position.z + halfSegmentWidth > route.position.z - halfRouteWidth

    return overlapX && overlapZ
  }

  public checkKeyframeSequence(
    segment: Segment,
    crane: Crane,
    obstacles: Obstacle[],
    tidalWindows: TidalWindow[],
    keyframes: Keyframe[]
  ): Map<number, CollisionResult[]> {
    const results = new Map<number, CollisionResult[]>()

    for (let i = 0; i < keyframes.length; i++) {
      const keyframe = keyframes[i]
      const keyframeTime = new Date(keyframe.timestamp)
      
      const collisionResults = this.checkAll(
        segment,
        crane,
        obstacles,
        tidalWindows,
        keyframe.position,
        keyframe.rotation,
        keyframe,
        keyframeTime
      )

      if (collisionResults.length > 0) {
        results.set(i, collisionResults)
      }
    }

    return results
  }

  public calculateSweepPath(
    startKeyframe: Keyframe,
    endKeyframe: Keyframe,
    steps: number = 20
  ): Keyframe[] {
    const path: Keyframe[] = []

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      path.push({
        id: `sweep-${i}`,
        timestamp: startKeyframe.timestamp + (endKeyframe.timestamp - startKeyframe.timestamp) * t,
        position: vec3.lerp(startKeyframe.position, endKeyframe.position, t),
        rotation: vec3.lerp(startKeyframe.rotation, endKeyframe.rotation, t),
        hookHeight: startKeyframe.hookHeight + (endKeyframe.hookHeight - startKeyframe.hookHeight) * t,
        boomAngle: startKeyframe.boomAngle + (endKeyframe.boomAngle - startKeyframe.boomAngle) * t,
        radius: startKeyframe.radius + (endKeyframe.radius - startKeyframe.radius) * t
      })
    }

    return path
  }
}

export const collisionEngine = new CollisionEngine()

export const getSeverityColor = (severity: CollisionSeverity): string => {
  switch (severity) {
    case 'critical': return '#F44336'
    case 'warning': return '#FF9800'
    case 'info': return '#2196F3'
  }
}

export const getCollisionTypeName = (type: CollisionType): string => {
  const nameMap: Record<CollisionType, string> = {
    radius_violation: '吊装半径违规',
    clearance_violation: '净空违规',
    gravity_offset: '重心偏移',
    tidal_window: '潮位窗口',
    obstacle_collision: '障碍物碰撞',
    boom_sweep: '吊臂扫掠',
    capacity_violation: '起重量违规',
    transport_blocked: '转运路线阻挡'
  }
  return nameMap[type] || type
}
