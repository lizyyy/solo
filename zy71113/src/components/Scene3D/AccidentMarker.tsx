interface AccidentMarkerProps {
  position: [number, number, number]
  visible: boolean
}

function AccidentMarker({ position, visible }: AccidentMarkerProps) {
  if (!visible) return null

  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[1.5, 1.5, 0.05, 32]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.5} />
      </mesh>

      <mesh position={[0, 0.1, 0]}>
        <torusGeometry args={[1.5, 0.1, 8, 32]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>

      <mesh position={[0, 2, 0]}>
        <coneGeometry args={[0.5, 1, 4]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>

      <mesh position={[0, 2.8, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
    </group>
  )
}

export default AccidentMarker
