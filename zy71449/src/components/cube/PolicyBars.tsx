import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCubeStore } from '@/store/useCubeStore'

export default function PolicyBars() {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([])
  const parameters = useCubeStore(s => s.parameters)
  const regions = useCubeStore(s => s.regions)
  const policies = useCubeStore(s => s.policies)
  const selectRegion = useCubeStore(s => s.selectRegion)

  const barData = useMemo(() => {
    const filtered = policies.filter(
      p =>
        p.typhoonId === parameters.typhoonId &&
        parameters.regionIds.includes(p.regionId)
    )

    const regionAgg = new Map<string, number>()
    for (const p of filtered) {
      regionAgg.set(p.regionId, (regionAgg.get(p.regionId) || 0) + p.insuredAmount)
    }

    const maxAmount = Math.max(...regionAgg.values(), 1)

    return parameters.regionIds
      .filter(rId => regionAgg.has(rId))
      .map((rId, idx) => {
        const amount = regionAgg.get(rId) || 0
        const height = Math.max(0.1, (amount / maxAmount) * 6)
        const spacing = 7 / Math.max(parameters.regionIds.length, 1)
        const x = (idx - parameters.regionIds.length / 2 + 0.5) * spacing
        const region = regions.find(r => r.id === rId)
        return {
          regionId: rId,
          regionName: region?.name || rId,
          x,
          height,
          amount,
        }
      })
  }, [policies, parameters.typhoonId, parameters.regionIds, regions])

  useFrame(({ clock }) => {
    meshRefs.current.forEach((mesh, i) => {
      if (mesh) {
        mesh.position.y = barData[i]?.height / 2 || 0
        const pulse = 1 + Math.sin(clock.getElapsedTime() * 1.5 + i * 0.5) * 0.01
        mesh.scale.y = pulse
      }
    })
  })

  const barWidth = Math.max(0.15, 6 / Math.max(barData.length * 1.5, 1))

  return (
    <group>
      {barData.map((bar, i) => (
        <mesh
          key={bar.regionId}
          ref={el => { meshRefs.current[i] = el }}
          position={[bar.x, bar.height / 2, 0]}
          onClick={(e) => {
            e.stopPropagation()
            selectRegion(bar.regionId)
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'default'
          }}
        >
          <boxGeometry args={[barWidth, bar.height, barWidth]} />
          <meshStandardMaterial
            color="#00897B"
            transparent
            opacity={0.6}
            emissive="#00E676"
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}
    </group>
  )
}
