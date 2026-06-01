import { Grid } from '@react-three/drei';

export function Ground() {
  return (
    <group>
      <Grid
        args={[30, 30]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#2a3142"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#3d465c"
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#1a1f2e" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}
