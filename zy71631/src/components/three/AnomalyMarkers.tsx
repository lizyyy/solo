import { useRef, useState, useMemo } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { Billboard, Html } from '@react-three/drei'
import * as THREE from 'three'
import useDataStore from '@/stores/dataStore'
import useSceneStore from '@/stores/sceneStore'
import { ANOMALY_COLORS } from '@/utils'
import type { Anomaly } from '@/types'

const AnomalyMarkers = () => {
  const anomalies = useDataStore((state) => state.anomalies)
  const seats = useDataStore((state) => state.seats)
  const speakers = useDataStore((state) => state.speakers)
  const currentBand = useSceneStore((state) => state.currentBand)
  const [selectedAnomaly, setSelectedAnomaly] = useState<string | null>(null)
  const groupRef = useRef<THREE.Group>(null)

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((a) => a.frequencyBand === currentBand || a.frequencyBand === 'all')
  }, [anomalies, currentBand])

  const getObjectPosition = (anomaly: Anomaly): [number, number, number] | null => {
    if (anomaly.seatId) {
      const seat = seats.find((s) => s.id === anomaly.seatId)
      if (seat) return [seat.x, seat.y + 1.2, seat.z]
    }
    if (anomaly.speakerId) {
      const speaker = speakers.find((s) => s.id === anomaly.speakerId)
      if (speaker) return [speaker.x, speaker.y + 1.2, speaker.z]
    }
    return null
  }

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const time = clock.getElapsedTime()
    groupRef.current.children.forEach((child, i) => {
      const offset = i * 0.3
      child.position.y = child.userData.baseY + Math.sin(time * 1.5 + offset) * 0.15
      child.rotation.y = time * 0.5 + offset
    })
  })

  const handleClick = (e: ThreeEvent<MouseEvent>, anomalyId: string) => {
    e.stopPropagation()
    setSelectedAnomaly(selectedAnomaly === anomalyId ? null : anomalyId)
  }

  return (
    <group ref={groupRef}>
      {filteredAnomalies.map((anomaly) => {
        const position = getObjectPosition(anomaly)
        if (!position) return null

        const color = ANOMALY_COLORS[anomaly.type] || '#ff0000'
        const isSelected = selectedAnomaly === anomaly.id

        return (
          <group
            key={anomaly.id}
            position={position}
            userData={{ baseY: position[1] }}
          >
            <Billboard>
              <mesh onClick={(e) => handleClick(e, anomaly.id)}>
                <coneGeometry args={[0.25, 0.5, 4]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={isSelected ? 0.8 : 0.3}
                />
              </mesh>
              {isSelected && (
                <group position={[0, 0.6, 0]}>
                  <Html center>
                    <div className="bg-black/90 text-white px-3 py-2 rounded-lg text-xs max-w-xs pointer-events-auto">
                      <div className="font-bold mb-1" style={{ color }}>
                        {anomaly.severity === 'error' ? '错误' : '警告'}
                      </div>
                      <div className="text-gray-200">{anomaly.message}</div>
                    </div>
                  </Html>
                </group>
              )}
            </Billboard>
          </group>
        )
      })}
    </group>
  )
}

export default AnomalyMarkers
