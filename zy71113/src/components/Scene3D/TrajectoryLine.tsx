import * as THREE from 'three'
import type { TrajectoryPoint } from '../../types'

interface TrajectoryLineProps {
  points: TrajectoryPoint[]
  color: string
}

function TrajectoryLine({ points, color }: TrajectoryLineProps) {
  const linePoints = points.map((p) => new THREE.Vector3(p.x, 0.05, p.y))
  const geometry = new THREE.BufferGeometry().setFromPoints(linePoints)

  return (
    <line>
      <bufferGeometry attach="geometry" {...geometry} />
      <lineBasicMaterial attach="material" color={color} linewidth={2} transparent opacity={0.6} />
    </line>
  )
}

export default TrajectoryLine
