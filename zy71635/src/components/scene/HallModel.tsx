import type { Hall } from '@/utils/types';

interface HallModelProps {
  hall: Hall;
}

export function HallModel({ hall }: HallModelProps) {
  const { width, depth, height } = hall;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#b45309" transparent opacity={0.3} side={2} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#1f2937" transparent opacity={0.2} side={2} />
      </mesh>

      <mesh position={[0, height / 2, -depth / 2]}>
        <boxGeometry args={[width, height, 0.1]} />
        <meshStandardMaterial color="#374151" transparent opacity={0.15} side={2} />
      </mesh>

      <mesh position={[0, height / 2, depth / 2]}>
        <boxGeometry args={[width, height, 0.1]} />
        <meshStandardMaterial color="#374151" transparent opacity={0.15} side={2} />
      </mesh>

      <mesh position={[-width / 2, height / 2, 0]}>
        <boxGeometry args={[0.1, height, depth]} />
        <meshStandardMaterial color="#374151" transparent opacity={0.15} side={2} />
      </mesh>

      <mesh position={[width / 2, height / 2, 0]}>
        <boxGeometry args={[0.1, height, depth]} />
        <meshStandardMaterial color="#374151" transparent opacity={0.15} side={2} />
      </mesh>
    </group>
  );
}
