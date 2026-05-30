import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import type { Position, TaskType } from '@/types'

interface PathRendererProps {
  path: Position[]
  routeType: TaskType
}

const PATH_COLORS: Record<TaskType, string> = {
  deliver: '#F0A500',
  clear: '#4A90D9',
}

const PathRenderer = React.memo(function PathRenderer({ path, routeType }: PathRendererProps) {
  const dashRef = useRef<any>(null)

  const points = useMemo(() => {
    if (path.length < 2) return null
    return path.map(p => new THREE.Vector3(p.x, 0.05, p.z))
  }, [path])

  useFrame((_, delta) => {
    if (dashRef.current) {
      dashRef.current.dashOffset -= delta * 2
    }
  })

  if (!points) return null

  return (
    <Line
      points={points}
      color={PATH_COLORS[routeType]}
      lineWidth={3}
      dashed
      dashSize={0.3}
      gapSize={0.15}
    >
      <lineDashedMaterial
        ref={dashRef}
        color={PATH_COLORS[routeType]}
        dashSize={0.3}
        gapSize={0.15}
        linewidth={3}
      />
    </Line>
  )
})

export default PathRenderer
