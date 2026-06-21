import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { StationRecord } from '@/types/station'

interface StationMarkerProps {
  record: StationRecord
  isSelected: boolean
  onClick: () => void
  customColor?: string
}

const COLOR_NORMAL = '#00D4AA'
const COLOR_ANOMALY = '#FF5A5F'
const COLOR_CLOUD = '#8A94A6'
const COLOR_WARN = '#FFB703'

export default function StationMarker({ record, isSelected, onClick, customColor }: StationMarkerProps) {
  const groupRef = useRef<THREE.Group>(null)
  const cylinderRef = useRef<THREE.Mesh>(null)
  const icosaRef = useRef<THREE.Mesh>(null)
  const torusRef = useRef<THREE.Mesh>(null)
  const cloudDomeRef = useRef<THREE.Mesh>(null)

  const x = (record.lng - 122.5) * 20
  const z = (record.lat - 30.5) * 20
  const h = record.energy_output * 0.4 + 2

  const isAnomaly = record.time_conflict || record.result_abnormal
  const isCloud = record.cloud_impact === '严重'
  const isWarn =
    record.cloud_impact === '部分' ||
    (record.status === '原始' && !isAnomaly && !isCloud)

  const color = useMemo(() => {
    if (customColor) return customColor
    if (isAnomaly) return COLOR_ANOMALY
    if (isCloud) return COLOR_CLOUD
    if (isWarn) return COLOR_WARN
    return COLOR_NORMAL
  }, [isAnomaly, isCloud, isWarn, customColor])

  const cloudDomeGeometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(1.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
    return geo
  }, [])

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    if (isAnomaly && torusRef.current) {
      const s = 1 + 0.2 * (Math.sin(t * 2) * 0.5 + 0.5)
      torusRef.current.scale.set(s, s, s)
    }

    if (isSelected) {
      const pulse = 0.4 + 0.8 * (Math.sin(t * 3) * 0.5 + 0.5)
      if (cylinderRef.current) {
        const mat = cylinderRef.current.material as THREE.MeshStandardMaterial
        mat.emissiveIntensity = pulse
      }
      if (icosaRef.current) {
        const mat = icosaRef.current.material as THREE.MeshStandardMaterial
        mat.emissiveIntensity = pulse
      }
    }

    if (groupRef.current) {
      const baseScale = isSelected ? 1.05 : 1
      groupRef.current.scale.set(baseScale, baseScale, baseScale)
    }
  })

  const handlePointerOver = (e: any) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
  }

  const handlePointerOut = (e: any) => {
    e.stopPropagation()
    document.body.style.cursor = 'default'
  }

  const handleClick = (e: any) => {
    e.stopPropagation()
    onClick()
  }

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <mesh ref={cylinderRef} position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.6, 0.8, h, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          roughness={0.6}
          metalness={0.2}
        />
      </mesh>

      <mesh ref={icosaRef} position={[0, h + 0.5, 0]} castShadow>
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>

      {isAnomaly && (
        <mesh ref={torusRef} position={[0, h / 2, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[1.8, 0.08, 16, 64]} />
          <meshStandardMaterial
            color={COLOR_ANOMALY}
            emissive={COLOR_ANOMALY}
            emissiveIntensity={0.6}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {isCloud && (
        <mesh
          ref={cloudDomeRef}
          position={[0, h, 0]}
          geometry={cloudDomeGeometry}
        >
          <meshStandardMaterial
            color={COLOR_CLOUD}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      <Text
        fontSize={0.35}
        color="white"
        anchorX="center"
        anchorY="middle"
        position={[0, -0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        outlineWidth={0.02}
        outlineColor="#041122"
      >
        {record.station_code}
      </Text>
    </group>
  )
}
