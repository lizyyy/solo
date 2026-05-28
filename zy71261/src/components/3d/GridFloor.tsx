import { Grid } from "@react-three/drei"

export default function GridFloor() {
  return (
    <group>
      <Grid
        args={[60, 60]}
        position={[0, -0.01, 0]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1e293b"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#334155"
        fadeDistance={50}
        fadeStrength={1}
        infiniteGrid={false}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial color="#070b14" transparent opacity={0.95} />
      </mesh>
    </group>
  )
}
