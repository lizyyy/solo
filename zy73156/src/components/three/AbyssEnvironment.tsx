import { Grid } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

function DepthRing({
  radius,
  color,
  y,
  opacity,
}: {
  radius: number;
  color: string;
  y: number;
  opacity: number;
}) {
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.06, radius, 96]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function LightShaft({ x, z }: { x: number; z: number }) {
  const geo = useMemo(() => new THREE.CylinderGeometry(0.08, 1.6, 16, 12, 1, true), []);
  return (
    <mesh position={[x, 3, z]} geometry={geo}>
      <meshBasicMaterial
        color="#5fd0ff"
        transparent
        opacity={0.06}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function AbyssEnvironment() {
  return (
    <group>
      <Grid
        position={[0, -10, 0]}
        args={[60, 60]}
        cellSize={2}
        cellThickness={0.6}
        cellColor="#16384f"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#1d6a8a"
        fadeDistance={42}
        fadeStrength={1.5}
        infiniteGrid
      />
      <DepthRing radius={8} color="#22D3EE" y={-9.95} opacity={0.25} />
      <DepthRing radius={14} color="#38BDF8" y={-9.95} opacity={0.16} />
      <DepthRing radius={20} color="#2DD4BF" y={-9.95} opacity={0.1} />
      <LightShaft x={-9} z={-6} />
      <LightShaft x={6} z={7} />
      <LightShaft x={2} z={-9} />
    </group>
  );
}
