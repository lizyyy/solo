import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCubeStore } from '@/store/useCubeStore'
import { SEVERITY_COLORS } from '@/engine/anomalyEngine'

export default function AnomalyMarkers() {
  const groupRef = useRef<THREE.Group>(null)
  const anomalies = useCubeStore(s => s.anomalies)
  const parameters = useCubeStore(s => s.parameters)
  const regions = useCubeStore(s => s.regions)
  const claims = useCubeStore(s => s.claims)
  const pathPoints = useCubeStore(s => s.typhoonPathPoints)

  const markerData = anomalies.filter(a =>
    a.type === 'path_time_misalign' || a.type === 'extreme_claim_occlusion'
  )

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    groupRef.current.children.forEach((child, i) => {
      if (child instanceof THREE.Mesh) {
        const scale = 1 + Math.sin(clock.getElapsedTime() * 4 + i * 1.2) * 0.4
        child.scale.setScalar(scale)
      }
    })
  })

  const regionIndexMap = new Map(parameters.regionIds.map((id, idx) => [id, idx]))

  return (
    <group ref={groupRef}>
      {markerData.map((anomaly, i) => {
        let position: [number, number, number] = [0, 4, 0]

        if (anomaly.type === 'path_time_misalign') {
          const point = pathPoints.find(p => p.id === anomaly.sourceId)
          if (point) {
            const t = (new Date(point.timestamp).getTime() - parameters.timeRange[0]) /
              (parameters.timeRange[1] - parameters.timeRange[0] || 1)
            position = [0, t * 8, 3.5]
          }
        } else if (anomaly.type === 'extreme_claim_occlusion') {
          const claim = claims.find(c => c.id === anomaly.sourceId)
          if (claim) {
            const rIdx = regionIndexMap.get(claim.regionId) || 0
            const spacing = 7 / Math.max(parameters.regionIds.length, 1)
            const x = (rIdx - parameters.regionIds.length / 2 + 0.5) * spacing
            const t = (new Date(claim.claimDate).getTime() - parameters.timeRange[0]) /
              (parameters.timeRange[1] - parameters.timeRange[0] || 1)
            position = [x, Math.max(0, Math.min(8, t * 8)), 0]
          }
        }

        const color = SEVERITY_COLORS[anomaly.severity] || '#FF6B35'

        return (
          <mesh key={anomaly.id} position={position}>
            <octahedronGeometry args={[0.2, 0]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.8}
              transparent
              opacity={0.85}
            />
          </mesh>
        )
      })}
    </group>
  )
}
