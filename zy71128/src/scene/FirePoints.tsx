import { useStore } from '../store/useStore';
import { FirePoint as FirePointType } from '../types';

interface FirePointProps {
  point: FirePointType;
}

function FirePointMarker({ point }: FirePointProps) {
  const scale = 0.5 + point.intensity * 0.5;
  
  return (
    <group position={[point.position.x, point.position.y + 3, point.position.z]}>
      <mesh scale={scale}>
        <coneGeometry args={[1, 2, 8]} />
        <meshBasicMaterial color="#FF4500" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 1, 0]} scale={scale * 0.8}>
        <coneGeometry args={[0.7, 1.5, 8]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.9} />
      </mesh>
      {!point.detected && (
        <mesh position={[0, 2, 0]}>
          <ringGeometry args={[1.5, 2, 32]} />
          <meshBasicMaterial color="#FF0000" transparent opacity={0.8} side={2} />
        </mesh>
      )}
    </group>
  );
}

export function FirePoints() {
  const showFirePoints = useStore(state => state.showFirePoints);
  const firePoints = useStore(state => state.firePoints);

  if (!showFirePoints) return null;

  return (
    <>
      {firePoints.map(point => (
        <FirePointMarker key={point.id} point={point} />
      ))}
    </>
  );
}
