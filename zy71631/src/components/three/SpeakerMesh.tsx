import { useRef } from 'react'
import { ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import useDataStore from '@/stores/dataStore'
import useSceneStore from '@/stores/sceneStore'

const getSpeakerColor = (model: string): string => {
  switch (model) {
    case 'LA112':
      return '#ffd700'
    case 'LA108':
      return '#3b82f6'
    case 'KS21':
      return '#a855f7'
    default:
      return '#6b7280'
  }
}

const SpeakerMesh = () => {
  const groupRef = useRef<THREE.Group>(null)
  const speakers = useDataStore((state) => state.speakers)
  const selectedObject = useSceneStore((state) => state.selectedObject)
  const setSelectedObject = useSceneStore((state) => state.setSelectedObject)

  const handleClick = (e: ThreeEvent<MouseEvent>, speakerId: string) => {
    e.stopPropagation()
    setSelectedObject({ type: 'speaker', id: speakerId })
  }

  return (
    <group ref={groupRef}>
      {speakers.map((speaker) => {
        const isSelected = selectedObject?.type === 'speaker' && selectedObject.id === speaker.id
        const color = getSpeakerColor(speaker.model)

        return (
          <group key={speaker.id}>
            <mesh
              position={[speaker.x, speaker.y, speaker.z]}
              rotation={[Math.PI, speaker.rotationY, 0]}
              onClick={(e) => handleClick(e, speaker.id)}
              onPointerOver={() => (document.body.style.cursor = 'pointer')}
              onPointerOut={() => (document.body.style.cursor = 'auto')}
            >
              <coneGeometry args={[0.6, 1.2, 16]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isSelected ? 0.5 : 0.1} />
            </mesh>
            {isSelected && (
              <mesh position={[speaker.x, speaker.y, speaker.z]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.7, 0.9, 32]} />
                <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} />
              </mesh>
            )}
            <Html position={[speaker.x, speaker.y + 1.5, speaker.z]} center>
              <div className="bg-black/70 text-white px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none">
                {speaker.label}
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

export default SpeakerMesh
