import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { colorTempToHex } from '@/utils/dataImporter'
import type { Light } from '@/types'

interface LightConeProps {
  light: Light
  selected: boolean
  onClick: () => void
}

export function LightCone({ light, selected, onClick }: LightConeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const color = useMemo(() => new THREE.Color(colorTempToHex(light.colorTemp)), [light.colorTemp])

  const { position, rotation, height, radius } = useMemo(() => {
    const lightPos = new THREE.Vector3(light.positionX, light.positionY, light.positionZ)
    const targetPos = new THREE.Vector3(light.targetX, light.targetY, light.targetZ)
    const direction = targetPos.clone().sub(lightPos).normalize()
    const height = lightPos.distanceTo(targetPos)
    const radius = Math.tan((light.angle * Math.PI) / 180 / 2) * height

    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction)
    const euler = new THREE.Euler().setFromQuaternion(quaternion)

    const midPoint = lightPos.clone().add(targetPos).multiplyScalar(0.5)

    return {
      position: [midPoint.x, midPoint.y, midPoint.z] as [number, number, number],
      rotation: [euler.x, euler.y, euler.z] as [number, number, number],
      height,
      radius,
    }
  }, [light])

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onClick() }}>
      <mesh position={position} rotation={rotation}>
        <coneGeometry args={[radius, height, 32, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.4 : 0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh position={position} rotation={rotation}>
        <coneGeometry args={[radius, height, 32, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.15 : 0.08}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      <mesh position={[light.positionX, light.positionY, light.positionZ]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color={selected ? '#ffffff' : color} />
      </mesh>

      {selected && (
        <mesh position={[light.positionX, light.positionY, light.positionZ]}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  )
}
