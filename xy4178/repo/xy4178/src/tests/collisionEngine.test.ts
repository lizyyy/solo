import { describe, it, expect, beforeEach } from 'vitest'
import { CollisionEngine } from '@/engine/collisionEngine'
import { Segment, Crane, Obstacle, TidalWindow, Keyframe } from '@/types'

describe('CollisionEngine', () => {
  let engine: CollisionEngine
  let testSegment: Segment
  let testCrane: Crane
  let testObstacles: Obstacle[]
  let testTidalWindows: TidalWindow[]

  beforeEach(() => {
    engine = new CollisionEngine({
      safetyMargin: 1.0,
      tidalHeightThreshold: 0.5,
      gravityTolerance: 0.1
    })

    testSegment = {
      id: 'test-segment',
      name: '测试分段',
      dimensions: { length: 20, width: 15, height: 10 },
      weight: 180,
      centerOfGravity: { x: 0, y: 0, z: 0 },
      liftingPoints: [
        { x: -8, y: 5, z: -5 },
        { x: 8, y: 5, z: -5 },
        { x: 8, y: 5, z: 5 },
        { x: -8, y: 5, z: 5 }
      ],
      initialPosition: { x: -30, y: 5, z: 0 },
      targetPosition: { x: 30, y: 5, z: 0 },
      color: '#4CAF50'
    }

    testCrane = {
      id: 'test-crane',
      name: '测试吊车',
      position: { x: 0, y: 0, z: 0 },
      maxRadius: 50,
      minRadius: 5,
      maxHeight: 80,
      maxLiftCapacity: 500,
      capacityCurve: [
        { radius: 5, capacity: 500 },
        { radius: 25, capacity: 350 },
        { radius: 50, capacity: 150 }
      ],
      boomLength: 60,
      jibLength: 0,
      slewSpeed: 1,
      hoistSpeed: 0.5,
      color: '#FF9800'
    }

    testObstacles = [
      {
        id: 'obs-1',
        name: '临时支架',
        type: 'temporary_support',
        dimensions: { length: 8, width: 8, height: 4 },
        position: { x: -10, y: 2, z: 10 },
        rotation: 0,
        isPermanent: false,
        color: '#F44336'
      }
    ]

    const now = Date.now()
    testTidalWindows = [
      {
        id: 'tidal-1',
        startTime: new Date(now - 2 * 60 * 60 * 1000),
        endTime: new Date(now + 2 * 60 * 60 * 1000),
        minHeight: 5,
        maxHeight: 8,
        safeClearance: 2,
        description: '测试潮位窗口'
      }
    ]
  })

  describe('radius check', () => {
    it('should detect radius violation when segment is beyond max radius', () => {
      const results = engine.checkAll(
        testSegment,
        testCrane,
        [],
        [],
        { x: 60, y: 10, z: 0 },
        { x: 0, y: 0, z: 0 },
        {
          id: 'kf-1',
          timestamp: Date.now(),
          position: { x: 60, y: 10, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          hookHeight: 20,
          boomAngle: 45,
          radius: 60
        }
      )

      const radiusViolations = results.filter((r) => r.type === 'radius_violation')
      expect(radiusViolations.length).toBeGreaterThan(0)
      expect(radiusViolations[0].severity).toBe('critical')
    })

    it('should detect minimum radius warning', () => {
      const results = engine.checkAll(
        testSegment,
        testCrane,
        [],
        [],
        { x: 3, y: 10, z: 0 },
        { x: 0, y: 0, z: 0 },
        {
          id: 'kf-1',
          timestamp: Date.now(),
          position: { x: 3, y: 10, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          hookHeight: 20,
          boomAngle: 45,
          radius: 3
        }
      )

      const radiusViolations = results.filter((r) => r.type === 'radius_violation')
      expect(radiusViolations.length).toBeGreaterThan(0)
      expect(radiusViolations[0].severity).toBe('warning')
    })

    it('should not report radius violation within safe range', () => {
      const results = engine.checkAll(
        testSegment,
        testCrane,
        [],
        [],
        { x: 25, y: 10, z: 0 },
        { x: 0, y: 0, z: 0 },
        {
          id: 'kf-1',
          timestamp: Date.now(),
          position: { x: 25, y: 10, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          hookHeight: 20,
          boomAngle: 45,
          radius: 25
        }
      )

      const radiusViolations = results.filter((r) => r.type === 'radius_violation')
      expect(radiusViolations.length).toBe(0)
    })
  })

  describe('capacity check', () => {
    it('should detect capacity violation when weight exceeds limit', () => {
      const heavySegment = { ...testSegment, weight: 400 }

      const results = engine.checkAll(
        heavySegment,
        testCrane,
        [],
        [],
        { x: 45, y: 10, z: 0 },
        { x: 0, y: 0, z: 0 },
        {
          id: 'kf-1',
          timestamp: Date.now(),
          position: { x: 45, y: 10, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          hookHeight: 20,
          boomAngle: 45,
          radius: 45
        }
      )

      const capacityViolations = results.filter((r) => r.type === 'capacity_violation')
      expect(capacityViolations.length).toBeGreaterThan(0)
    })

    it('should not report capacity violation within limit', () => {
      const results = engine.checkAll(
        testSegment,
        testCrane,
        [],
        [],
        { x: 25, y: 10, z: 0 },
        { x: 0, y: 0, z: 0 },
        {
          id: 'kf-1',
          timestamp: Date.now(),
          position: { x: 25, y: 10, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          hookHeight: 20,
          boomAngle: 45,
          radius: 25
        }
      )

      const capacityViolations = results.filter((r) => r.type === 'capacity_violation')
      expect(capacityViolations.length).toBe(0)
    })
  })

  describe('obstacle collision check', () => {
    it('should detect collision with obstacle', () => {
      const results = engine.checkAll(
        testSegment,
        testCrane,
        testObstacles,
        [],
        { x: -10, y: 5, z: 10 },
        { x: 0, y: 0, z: 0 },
        {
          id: 'kf-1',
          timestamp: Date.now(),
          position: { x: -10, y: 5, z: 10 },
          rotation: { x: 0, y: 0, z: 0 },
          hookHeight: 15,
          boomAngle: 45,
          radius: 14
        }
      )

      const obstacleCollisions = results.filter((r) => r.type === 'obstacle_collision')
      expect(obstacleCollisions.length).toBeGreaterThan(0)
    })

    it('should not report collision when far from obstacle', () => {
      const results = engine.checkAll(
        testSegment,
        testCrane,
        testObstacles,
        [],
        { x: 30, y: 5, z: 0 },
        { x: 0, y: 0, z: 0 },
        {
          id: 'kf-1',
          timestamp: Date.now(),
          position: { x: 30, y: 5, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          hookHeight: 15,
          boomAngle: 45,
          radius: 30
        }
      )

      const obstacleCollisions = results.filter((r) => r.type === 'obstacle_collision')
      expect(obstacleCollisions.length).toBe(0)
    })
  })

  describe('tidal window check', () => {
    it('should detect when current time is within tidal window', () => {
      const now = new Date()
      const results = engine.checkAll(
        testSegment,
        testCrane,
        [],
        testTidalWindows,
        { x: 25, y: 10, z: 0 },
        { x: 0, y: 0, z: 0 },
        {
          id: 'kf-1',
          timestamp: now.getTime(),
          position: { x: 25, y: 10, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          hookHeight: 20,
          boomAngle: 45,
          radius: 25
        },
        now
      )

      const tidalViolations = results.filter((r) => r.type === 'tidal_window')
      expect(tidalViolations.length).toBe(0)
    })

    it('should report warning when no tidal windows configured', () => {
      const results = engine.checkAll(
        testSegment,
        testCrane,
        [],
        [],
        { x: 25, y: 10, z: 0 },
        { x: 0, y: 0, z: 0 },
        {
          id: 'kf-1',
          timestamp: Date.now(),
          position: { x: 25, y: 10, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          hookHeight: 20,
          boomAngle: 45,
          radius: 25
        }
      )

      const tidalResults = results.filter((r) => r.type === 'tidal_window')
      expect(tidalResults.length).toBeGreaterThan(0)
    })
  })

  describe('gravity offset check', () => {
    it('should detect significant gravity offset', () => {
      const offCenterSegment = {
        ...testSegment,
        centerOfGravity: { x: 5, y: 0, z: 3 }
      }

      const results = engine.checkAll(
        offCenterSegment,
        testCrane,
        [],
        [],
        { x: 25, y: 10, z: 0 },
        { x: 10, y: 0, z: 5 },
        {
          id: 'kf-1',
          timestamp: Date.now(),
          position: { x: 25, y: 10, z: 0 },
          rotation: { x: 10, y: 0, z: 5 },
          hookHeight: 20,
          boomAngle: 45,
          radius: 25
        }
      )

      const gravityResults = results.filter((r) => r.type === 'gravity_offset')
      expect(gravityResults.length).toBeGreaterThan(0)
    })
  })

  describe('keyframe sequence check', () => {
    it('should check all keyframes in sequence', () => {
      const keyframes: Keyframe[] = [
        {
          id: 'kf-1',
          timestamp: Date.now(),
          position: { x: 60, y: 10, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          hookHeight: 20,
          boomAngle: 45,
          radius: 60
        },
        {
          id: 'kf-2',
          timestamp: Date.now() + 60000,
          position: { x: 25, y: 20, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          hookHeight: 30,
          boomAngle: 50,
          radius: 25
        }
      ]

      const results = engine.checkKeyframeSequence(
        testSegment,
        testCrane,
        testObstacles,
        testTidalWindows,
        keyframes
      )

      expect(results.size).toBeGreaterThan(0)
      
      const firstKeyframeResults = results.get(0)
      expect(firstKeyframeResults?.some((r) => r.type === 'radius_violation')).toBe(true)
    })
  })

  describe('sweep path calculation', () => {
    it('should generate interpolated path between keyframes', () => {
      const startKeyframe: Keyframe = {
        id: 'start',
        timestamp: 0,
        position: { x: 0, y: 10, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        hookHeight: 20,
        boomAngle: 45,
        radius: 0
      }

      const endKeyframe: Keyframe = {
        id: 'end',
        timestamp: 1000,
        position: { x: 100, y: 20, z: 50 },
        rotation: { x: 5, y: 90, z: 0 },
        hookHeight: 30,
        boomAngle: 50,
        radius: 100
      }

      const path = engine.calculateSweepPath(startKeyframe, endKeyframe, 10)

      expect(path.length).toBe(11)
      expect(path[0].position).toEqual(startKeyframe.position)
      expect(path[10].position).toEqual(endKeyframe.position)
      
      expect(path[5].position.x).toBeCloseTo(50)
      expect(path[5].position.y).toBeCloseTo(15)
      expect(path[5].position.z).toBeCloseTo(25)
    })
  })
})
