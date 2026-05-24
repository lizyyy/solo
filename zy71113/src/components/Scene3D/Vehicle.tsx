import type { VehicleType } from '../../types'

interface VehicleProps {
  position: [number, number, number]
  color: string
  type: VehicleType
  rotation?: number
}

function Vehicle({ position, color, type, rotation = 0 }: VehicleProps) {
  const dimensions = {
    car: { width: 1.8, length: 4, height: 1.2 },
    truck: { width: 2.2, length: 6, height: 1.8 },
    motorcycle: { width: 0.8, length: 2, height: 1 },
  }

  const dim = dimensions[type]

  return (
    <group position={position} rotation={[0, (rotation * Math.PI) / 180, 0]}>
      <mesh castShadow position={[0, dim.height / 2, 0]}>
        <boxGeometry args={[dim.width, dim.height, dim.length]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
      </mesh>

      <mesh castShadow position={[0, dim.height * 0.7, dim.length * 0.1]}>
        <boxGeometry args={[dim.width * 0.9, dim.height * 0.5, dim.length * 0.5]} />
        <meshStandardMaterial color="#1a1a2e" transparent opacity={0.6} />
      </mesh>

      <mesh position={[dim.width * 0.4, 0.3, dim.length * 0.35]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-dim.width * 0.4, 0.3, dim.length * 0.35]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={0.5} />
      </mesh>

      <mesh position={[dim.width * 0.4, 0.3, -dim.length * 0.4]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[-dim.width * 0.4, 0.3, -dim.length * 0.4]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

export default Vehicle
