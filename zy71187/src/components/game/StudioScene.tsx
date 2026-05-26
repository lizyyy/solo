import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Html, ContactShadows } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'
import type { EquipmentItem, Level, RedHerring } from '@/types'

function ReturnTable() {
  return (
    <group position={[0, -0.05, 0]}>
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[20, 1, 8]} />
        <meshStandardMaterial color="#8B6914" />
      </mesh>
      <mesh position={[-8, -0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, 0.5, 6]} />
        <meshStandardMaterial color="#6B4423" />
      </mesh>
      <mesh position={[8, -0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, 0.5, 6]} />
        <meshStandardMaterial color="#6B4423" />
      </mesh>
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[16, 0.1, 6]} />
        <meshStandardMaterial color="#A0522D" />
      </mesh>
    </group>
  )
}

function EquipmentRack() {
  return (
    <group position={[0, 2, -4]}>
      <mesh>
        <boxGeometry args={[18, 0.15, 1]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh position={[-8.5, -1.5, 0]}>
        <boxGeometry args={[0.15, 3, 1]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <mesh position={[8.5, -1.5, 0]}>
        <boxGeometry args={[0.15, 3, 1]} />
        <meshStandardMaterial color="#444" />
      </mesh>
    </group>
  )
}

interface EquipmentObjectProps {
  equipment: EquipmentItem
  isSelected: boolean
  onClick: () => void
}

function EquipmentObject({ equipment, isSelected, onClick }: EquipmentObjectProps) {
  const typeColors: Record<string, string> = {
    camera: '#2a2a2a',
    lens: '#1a1a1a',
    light_stand: '#333',
    battery: '#444',
    memory_card: '#555',
    filter: '#88CCFF',
    tripod: '#3a3a3a',
    reflector: '#DDDDDD',
  }

  return (
    <group
      position={[equipment.position.x, equipment.position.y + 0.6, equipment.position.z]}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <mesh castShadow>
        <boxGeometry args={[1.2, 0.8, 0.8]} />
        <meshStandardMaterial
          color={typeColors[equipment.type] || '#666'}
          emissive={isSelected ? '#f59e0b' : '#000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>
      <Html position={[0, 0.6, 0]} center>
        <div
          className={`text-3xl cursor-pointer transition-transform hover:scale-110 ${
            isSelected ? 'scale-110' : ''
          }`}
        >
          {equipment.icon}
        </div>
      </Html>
      <Html position={[0, -0.7, 0]} center>
        <div
          className={`px-2 py-1 rounded text-xs font-mono whitespace-nowrap ${
            isSelected
              ? 'bg-amber-500 text-black'
              : 'bg-black/70 text-white'
          }`}
        >
          {equipment.name}
        </div>
      </Html>
    </group>
  )
}

interface RedHerringObjectProps {
  item: RedHerring
  onClick: () => void
  isIdentified: boolean
}

function RedHerringObject({ item, onClick, isIdentified }: RedHerringObjectProps) {
  return (
    <group
      position={[item.position.x, 0.6, item.position.z]}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <mesh castShadow>
        <boxGeometry args={[0.8, 0.6, 0.6]} />
        <meshStandardMaterial
          color={isIdentified ? '#10b981' : '#8B0000'}
          emissive={isIdentified ? '#10b981' : '#000'}
          emissiveIntensity={isIdentified ? 0.4 : 0}
        />
      </mesh>
      <Html position={[0, 0.5, 0]} center>
        <div className="text-2xl">{item.icon}</div>
      </Html>
      <Html position={[0, -0.6, 0]} center>
        <div className="px-2 py-1 rounded text-xs bg-green-900/70 text-green-300 font-mono whitespace-nowrap">
          {item.name}
        </div>
      </Html>
    </group>
  )
}

interface StudioSceneProps {
  level: Level
  selectedEquipmentId: string | null
  onSelectEquipment: (id: string | null) => void
  identifiedRedHerrings: string[]
  onIdentifyRedHerring: (id: string) => void
}

export default function StudioScene({
  level,
  selectedEquipmentId,
  onSelectEquipment,
  identifiedRedHerrings,
  onIdentifyRedHerring,
}: StudioSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 8, 10], fov: 45 }}
      onPointerMissed={() => onSelectEquipment(null)}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#1a2332']} />
      <fog attach="fog" args={['#1a2332', 15, 30]} />

      <ambientLight intensity={0.3} />
      <spotLight
        position={[0, 12, 0]}
        angle={0.5}
        penumbra={0.8}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <spotLight position={[-8, 8, 5]} angle={0.4} penumbra={0.5} intensity={0.6} />
      <spotLight position={[8, 8, 5]} angle={0.4} penumbra={0.5} intensity={0.6} />

      <ReturnTable />
      <EquipmentRack />

      {level.equipment.map((eq) => (
        <EquipmentObject
          key={eq.id}
          equipment={eq}
          isSelected={selectedEquipmentId === eq.id}
          onClick={() => onSelectEquipment(eq.id)}
        />
      ))}

      {level.redHerrings.map((rh) => (
        <RedHerringObject
          key={rh.id}
          item={rh}
          onClick={() => onIdentifyRedHerring(rh.id)}
          isIdentified={identifiedRedHerrings.includes(rh.id)}
        />
      ))}

      <ContactShadows position={[0, -0.4, 0]} opacity={0.5} scale={20} blur={2} far={4} />

      <OrbitControls
        enablePan={false}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 6}
        minDistance={8}
        maxDistance={18}
      />
    </Canvas>
  )
}
