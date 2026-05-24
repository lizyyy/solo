import type { LightState, Direction } from '../../types'

interface TrafficLightProps {
  position: { x: number; y: number; z: number }
  state: LightState
  direction: Direction
}

function TrafficLight({ position, state, direction }: TrafficLightProps) {
  const lightColors = {
    red: state === 'red' ? '#ef4444' : '#4a1a1a',
    yellow: state === 'yellow' ? '#eab308' : '#4a4a1a',
    green: state === 'green' ? '#22c55e' : '#1a4a1a',
  }

  const rotations: Record<Direction, number> = {
    north: 0,
    south: Math.PI,
    east: Math.PI / 2,
    west: -Math.PI / 2,
  }

  return (
    <group position={[position.x, position.z, position.y]} rotation={[0, rotations[direction], 0]}>
      <mesh castShadow position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.1, 0.15, 5, 8]} />
        <meshStandardMaterial color="#374151" />
      </mesh>

      <mesh castShadow position={[0, 4.5, 0.5]}>
        <boxGeometry args={[0.6, 2, 0.4]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      <mesh position={[0, 5, 0.71]}>
        <circleGeometry args={[0.2, 16]} />
        <meshStandardMaterial
          color={lightColors.red}
          emissive={lightColors.red}
          emissiveIntensity={state === 'red' ? 1 : 0}
        />
      </mesh>

      <mesh position={[0, 4.5, 0.71]}>
        <circleGeometry args={[0.2, 16]} />
        <meshStandardMaterial
          color={lightColors.yellow}
          emissive={lightColors.yellow}
          emissiveIntensity={state === 'yellow' ? 1 : 0}
        />
      </mesh>

      <mesh position={[0, 4, 0.71]}>
        <circleGeometry args={[0.2, 16]} />
        <meshStandardMaterial
          color={lightColors.green}
          emissive={lightColors.green}
          emissiveIntensity={state === 'green' ? 1 : 0}
        />
      </mesh>
    </group>
  )
}

export default TrafficLight
