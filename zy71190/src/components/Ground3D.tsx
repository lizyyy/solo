import * as THREE from "three";

interface Props {
  boundary: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export function Ground3D({ boundary }: Props) {
  const w = boundary.maxX - boundary.minX;
  const h = boundary.maxZ - boundary.minZ;
  const cx = (boundary.minX + boundary.maxX) / 2;
  const cz = (boundary.minZ + boundary.maxZ) / 2;

  return (
    <mesh position={[cx, -0.01, cz]} receiveShadow>
      <boxGeometry args={[w + 4, 0.05, h + 4]} />
      <meshStandardMaterial color="#0f1a2e" roughness={0.9} metalness={0.2} />
    </mesh>
  );
}
