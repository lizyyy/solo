import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCubeStore } from '@/store/useCubeStore'

export default function ClaimMarkers() {
  const groupRef = useRef<THREE.Group>(null)
  const parameters = useCubeStore(s => s.parameters)
  const claims = useCubeStore(s => s.claims)
  const regions = useCubeStore(s => s.regions)
  const anomalies = useCubeStore(s => s.anomalies)
  const selectRegion = useCubeStore(s => s.selectRegion)

  const markerData = useMemo(() => {
    const filtered = claims.filter(
      c =>
        c.typhoonId === parameters.typhoonId &&
        parameters.regionIds.includes(c.regionId) &&
        c.claimAmount >= parameters.claimThreshold
    )

    const extremeIds = new Set(
      anomalies.filter(a => a.type === 'extreme_claim_occlusion').map(a => a.sourceId)
    )

    const regionTotals = new Map<string, number>()
    for (const c of filtered) {
      regionTotals.set(c.regionId, (regionTotals.get(c.regionId) || 0) + c.claimAmount)
    }

    const maxAmount = Math.max(...Array.from(regionTotals.values()), 1)
    const regionIndexMap = new Map(parameters.regionIds.map((id, idx) => [id, idx]))
    const timeStart = parameters.timeRange[0]
    const timeEnd = parameters.timeRange[1]
    const timeSpan = timeEnd - timeStart || 1

    return filtered.map(c => {
      const rIdx = regionIndexMap.get(c.regionId) || 0
      const spacing = 7 / Math.max(parameters.regionIds.length, 1)
      const x = (rIdx - parameters.regionIds.length / 2 + 0.5) * spacing
      const claimTime = new Date(c.claimDate).getTime()
      const y = ((claimTime - timeStart) / timeSpan) * 8
      const z = (c.claimAmount / maxAmount) * 3 - 1.5

      const isExtreme = extremeIds.has(c.id)
      const regionTotal = regionTotals.get(c.regionId) || 1
      const ratio = c.claimAmount / regionTotal

      return {
        id: c.id,
        regionId: c.regionId,
        x,
        y: Math.max(0, Math.min(8, y)),
        z,
        isExtreme,
        ratio,
        claimAmount: c.claimAmount,
        source: c.source,
      }
    })
  }, [claims, parameters, anomalies, regions])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    groupRef.current.children.forEach((child, i) => {
      const data = markerData[i]
      if (data?.isExtreme && child instanceof THREE.Mesh) {
        const scale = 1 + Math.sin(clock.getElapsedTime() * 3 + i) * 0.3
        child.scale.setScalar(scale)
      }
    })
  })

  return (
    <group ref={groupRef}>
      {markerData.map((m, i) => (
        <mesh
          key={m.id}
          position={[m.x, m.y, m.z]}
          onClick={(e) => {
            e.stopPropagation()
            selectRegion(m.regionId)
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'default'
          }}
        >
          <sphereGeometry args={[m.isExtreme ? 0.15 : 0.08, 12, 12]} />
          <meshStandardMaterial
            color={m.isExtreme ? '#FF6B35' : '#00E676'}
            emissive={m.isExtreme ? '#FF6B35' : '#00E676'}
            emissiveIntensity={m.isExtreme ? 0.6 : 0.2}
            transparent
            opacity={m.isExtreme ? 0.9 : 0.7}
          />
        </mesh>
      ))}
    </group>
  )
}
