import { createContext, useContext, useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  SceneState,
  Segment,
  Crane,
  Obstacle,
  TidalWindow,
  Keyframe,
  ReviewComment,
  CollisionResult,
  Vector3D
} from '@/types'
import { collisionEngine } from '@/engine/collisionEngine'
import { vec3 } from '@/utils/math'

const initialCrane: Crane = {
  id: uuidv4(),
  name: '码头吊车-1',
  position: { x: 0, y: 0, z: 0 },
  maxRadius: 50,
  minRadius: 5,
  maxHeight: 80,
  maxLiftCapacity: 500,
  capacityCurve: [
    { radius: 5, capacity: 500 },
    { radius: 20, capacity: 400 },
    { radius: 35, capacity: 250 },
    { radius: 50, capacity: 150 }
  ],
  boomLength: 60,
  jibLength: 0,
  slewSpeed: 1,
  hoistSpeed: 0.5,
  color: '#FF9800'
}

const createInitialState = (): SceneState => ({
  id: uuidv4(),
  name: '新吊装方案',
  createdAt: new Date(),
  updatedAt: new Date(),
  segments: [],
  crane: initialCrane,
  obstacles: [],
  tidalWindows: [],
  keyframes: [],
  currentKeyframeIndex: 0,
  comments: [],
  collisionResults: []
})

interface SceneContextType {
  scene: SceneState
  setSegments: (segments: Segment[]) => void
  setCrane: (crane: Crane) => void
  setObstacles: (obstacles: Obstacle[]) => void
  setTidalWindows: (windows: TidalWindow[]) => void
  addKeyframe: (position: Vector3D, rotation: Vector3D, hookHeight: number) => void
  updateKeyframe: (id: string, updates: Partial<Keyframe>) => void
  removeKeyframe: (id: string) => void
  setCurrentKeyframeIndex: (index: number) => void
  addComment: (segmentId: string, content: string, author: string, keyframeId?: string) => void
  resolveComment: (id: string, resolver: string) => void
  updateSceneName: (name: string) => void
  runCollisionCheck: () => void
  resetScene: () => void
  getSegmentById: (id: string) => Segment | undefined
  getObstacleById: (id: string) => Obstacle | undefined
  getKeyframeById: (id: string) => Keyframe | undefined
  loadScene: (scene: SceneState) => void
}

export const SceneContext = createContext<SceneContextType | null>(null)

export const useScene = () => {
  const context = useContext(SceneContext)
  if (!context) {
    throw new Error('useScene must be used within SceneProvider')
  }
  return context
}

export const SceneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scene, setScene] = useState<SceneState>(createInitialState)

  const updateScene = useCallback((updates: Partial<SceneState>) => {
    setScene(prev => ({
      ...prev,
      ...updates,
      updatedAt: new Date()
    }))
  }, [])

  const setSegments = useCallback((segments: Segment[]) => {
    updateScene({ segments })
  }, [updateScene])

  const setCrane = useCallback((crane: Crane) => {
    updateScene({ crane })
  }, [updateScene])

  const setObstacles = useCallback((obstacles: Obstacle[]) => {
    updateScene({ obstacles })
  }, [updateScene])

  const setTidalWindows = useCallback((windows: TidalWindow[]) => {
    updateScene({ tidalWindows: windows })
  }, [updateScene])

  const addKeyframe = useCallback((position: Vector3D, rotation: Vector3D, hookHeight: number) => {
    const radius = vec3.distance2D(scene.crane.position, position)
    const boomAngle = Math.atan2(hookHeight - scene.crane.position.y, radius) * (180 / Math.PI)

    const newKeyframe: Keyframe = {
      id: uuidv4(),
      timestamp: Date.now() + scene.keyframes.length * 60000,
      position,
      rotation,
      hookHeight,
      boomAngle,
      radius,
      label: `关键帧 ${scene.keyframes.length + 1}`
    }

    updateScene({
      keyframes: [...scene.keyframes, newKeyframe]
    })
  }, [scene.crane, scene.keyframes.length, updateScene])

  const updateKeyframe = useCallback((id: string, updates: Partial<Keyframe>) => {
    const newKeyframes = scene.keyframes.map(kf => 
      kf.id === id ? { ...kf, ...updates } : kf
    )
    updateScene({ keyframes: newKeyframes })
  }, [scene.keyframes, updateScene])

  const removeKeyframe = useCallback((id: string) => {
    const newKeyframes = scene.keyframes.filter(kf => kf.id !== id)
    updateScene({ keyframes: newKeyframes })
  }, [scene.keyframes, updateScene])

  const setCurrentKeyframeIndex = useCallback((index: number) => {
    updateScene({ currentKeyframeIndex: index })
  }, [updateScene])

  const addComment = useCallback((segmentId: string, content: string, author: string, keyframeId?: string) => {
    const comment: ReviewComment = {
      id: uuidv4(),
      segmentId,
      keyframeId,
      author,
      timestamp: new Date(),
      content,
      isResolved: false
    }
    updateScene({ comments: [...scene.comments, comment] })
  }, [scene.comments, updateScene])

  const resolveComment = useCallback((id: string, resolver: string) => {
    const newComments = scene.comments.map(c => 
      c.id === id ? { ...c, isResolved: true, resolvedAt: new Date(), resolver } : c
    )
    updateScene({ comments: newComments })
  }, [scene.comments, updateScene])

  const updateSceneName = useCallback((name: string) => {
    updateScene({ name })
  }, [updateScene])

  const runCollisionCheck = useCallback(() => {
    const allResults: CollisionResult[] = []

    if (scene.segments.length === 0) {
      updateScene({ collisionResults: [] })
      return
    }

    const segment = scene.segments[0]

    if (scene.keyframes.length === 0) {
      const defaultKeyframe: Keyframe = {
        id: 'temp',
        timestamp: Date.now(),
        position: segment.initialPosition,
        rotation: { x: 0, y: 0, z: 0 },
        hookHeight: segment.initialPosition.y + segment.dimensions.height,
        boomAngle: 45,
        radius: vec3.distance2D(scene.crane.position, segment.initialPosition)
      }

      const results = collisionEngine.checkAll(
        segment,
        scene.crane,
        scene.obstacles,
        scene.tidalWindows,
        segment.initialPosition,
        { x: 0, y: 0, z: 0 },
        defaultKeyframe
      )
      allResults.push(...results)
    } else {
      for (const keyframe of scene.keyframes) {
        const keyframeTime = new Date(keyframe.timestamp)
        const results = collisionEngine.checkAll(
          segment,
          scene.crane,
          scene.obstacles,
          scene.tidalWindows,
          keyframe.position,
          keyframe.rotation,
          keyframe,
          keyframeTime
        )
        allResults.push(...results)
      }
    }

    updateScene({ collisionResults: allResults })
  }, [scene, updateScene])

  const resetScene = useCallback(() => {
    setScene(createInitialState())
  }, [])

  const getSegmentById = useCallback((id: string) => {
    return scene.segments.find(s => s.id === id)
  }, [scene.segments])

  const getObstacleById = useCallback((id: string) => {
    return scene.obstacles.find(o => o.id === id)
  }, [scene.obstacles])

  const getKeyframeById = useCallback((id: string) => {
    return scene.keyframes.find(kf => kf.id === id)
  }, [scene.keyframes])

  const loadScene = useCallback((loadedScene: SceneState) => {
    setScene(loadedScene)
  }, [])

  const value: SceneContextType = {
    scene,
    setSegments,
    setCrane,
    setObstacles,
    setTidalWindows,
    addKeyframe,
    updateKeyframe,
    removeKeyframe,
    setCurrentKeyframeIndex,
    addComment,
    resolveComment,
    updateSceneName,
    runCollisionCheck,
    resetScene,
    getSegmentById,
    getObstacleById,
    getKeyframeById,
    loadScene
  }

  return (
    <SceneContext.Provider value={value}>
      {children}
    </SceneContext.Provider>
  )
}
