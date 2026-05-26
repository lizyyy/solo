import { Shelf } from '../../types/game';

interface Shelf3DProps {
  shelf: Shelf;
  cellSize?: number;
  gridWidth: number;
  gridHeight: number;
}

export function Shelf3D({ shelf, cellSize = 1, gridWidth, gridHeight }: Shelf3DProps) {
  const offsetX = -gridWidth * cellSize / 2;
  const offsetZ = -gridHeight * cellSize / 2;

  const x = shelf.position.x * cellSize + cellSize / 2 + offsetX;
  const z = shelf.position.y * cellSize + cellSize / 2 + offsetZ;

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[cellSize * 0.8, 0.8, cellSize * 0.8]} />
        <meshStandardMaterial color="#8B4513" metalness={0.1} roughness={0.8} />
      </mesh>

      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[cellSize * 0.85, 0.1, cellSize * 0.85]} />
        <meshStandardMaterial color="#654321" metalness={0.2} roughness={0.7} />
      </mesh>

      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[cellSize * 0.85, 0.1, cellSize * 0.85]} />
        <meshStandardMaterial color="#654321" metalness={0.2} roughness={0.7} />
      </mesh>

      {shelf.hasGoods && (
        <group position={[0, 0.5, 0]}>
          <mesh position={[-0.15, 0, 0.1]}>
            <boxGeometry args={[0.25, 0.3, 0.25]} />
            <meshStandardMaterial color={getGoodsColor(shelf.goodsType)} />
          </mesh>
          <mesh position={[0.15, 0, -0.1]}>
            <boxGeometry args={[0.25, 0.3, 0.25]} />
            <meshStandardMaterial color={getGoodsColor(shelf.goodsType)} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function getGoodsColor(type?: string): string {
  switch (type) {
    case 'A': return '#FF6B6B';
    case 'B': return '#4ECDC4';
    case 'C': return '#45B7D1';
    case 'D': return '#96CEB4';
    case 'E': return '#FFEAA7';
    case 'F': return '#DDA0DD';
    case 'G': return '#FF8C42';
    default: return '#CCCCCC';
  }
}
