interface PedestrianProps {
  position: [number, number, number]
}

function Pedestrian({ position }: PedestrianProps) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 0.8, 8]} />
        <meshStandardMaterial color="#6366f1" />
      </mesh>

      <mesh castShadow position={[0, 1, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#fcd5ce" />
      </mesh>

      <mesh castShadow position={[0.15, 0.4, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.6, 6]} />
        <meshStandardMaterial color="#fcd5ce" />
      </mesh>
      <mesh castShadow position={[-0.15, 0.4, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.6, 6]} />
        <meshStandardMaterial color="#fcd5ce" />
      </mesh>
    </group>
  )
}

export default Pedestrian
