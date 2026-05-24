import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { useSceneStore } from '../../store/useSceneStore';
import { calculateLiftPath } from '../../utils/cranePhysics';

const LiftPath = () => {
  const { liftObject } = useSceneStore();
  
  const pathPoints = useMemo(() => {
    const points: [number, number, number][] = [];
    for (let i = 0; i <= 50; i++) {
      const progress = i / 50;
      const pos = calculateLiftPath(liftObject, progress);
      points.push([pos.x, pos.y + 0.5, pos.z]);
    }
    return points;
  }, [liftObject]);
  
  const currentPosition = useMemo(() => {
    return calculateLiftPath(liftObject, liftObject.currentProgress);
  }, [liftObject]);
  
  return (
    <group>
      <Line
        points={pathPoints}
        color="#165DFF"
        transparent
        opacity={0.6}
        lineWidth={2}
      />
      
      <mesh position={[liftObject.startPosition.x, 0.5, liftObject.startPosition.z]}>
        <cylinderGeometry args={[1.5, 1.5, 0.2, 32]} />
        <meshBasicMaterial color="#52C41A" transparent opacity={0.7} />
      </mesh>
      
      <mesh position={[liftObject.endPosition.x, 0.5, liftObject.endPosition.z]}>
        <cylinderGeometry args={[1.5, 1.5, 0.2, 32]} />
        <meshBasicMaterial color="#FAAD14" transparent opacity={0.7} />
      </mesh>
      
      <group position={[currentPosition.x, currentPosition.y + 3, currentPosition.z]}>
        <mesh>
          <boxGeometry args={[3, 2, 2]} />
          <meshStandardMaterial color="#4A90D9" metalness={0.4} roughness={0.5} />
        </mesh>
        
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 5, 8]} />
          <meshStandardMaterial color="#888888" />
        </mesh>
      </group>
    </group>
  );
};

export default LiftPath;
