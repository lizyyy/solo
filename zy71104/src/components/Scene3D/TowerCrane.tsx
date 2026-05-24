import { useMemo } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { calculateLiftPath } from '../../utils/cranePhysics';

const TowerCrane = () => {
  const { crane, liftObject } = useSceneStore();
  
  const liftPosition = useMemo(() => {
    return calculateLiftPath(liftObject, liftObject.currentProgress);
  }, [liftObject]);
  
  const towerSegments = 10;
  const towerHeight = crane.height;
  const segmentHeight = towerHeight / towerSegments;
  
  return (
    <group position={[crane.position.x, 0, crane.position.z]}>
      {Array.from({ length: towerSegments }).map((_, i) => (
        <mesh key={i} position={[0, segmentHeight * i + segmentHeight / 2, 0]}>
          <boxGeometry args={[1.5, segmentHeight * 0.95, 1.5]} />
          <meshStandardMaterial color="#FF6B35" metalness={0.3} roughness={0.7} />
        </mesh>
      ))}
      
      <mesh position={[0, towerHeight, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#CC5522" metalness={0.4} roughness={0.6} />
      </mesh>
      
      <group position={[0, towerHeight, 0]} rotation={[0, (crane.currentAngle * Math.PI) / 180, 0]}>
        <mesh position={[crane.currentRadius / 2, 0, 0]}>
          <boxGeometry args={[crane.currentRadius + 5, 0.6, 1.2]} />
          <meshStandardMaterial color="#FF8C42" metalness={0.3} roughness={0.7} />
        </mesh>
        
        <mesh position={[crane.currentRadius, 0, 0]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.3} />
        </mesh>
        
        <mesh position={[-5, 0, 0]}>
          <boxGeometry args={[10, 0.6, 1.2]} />
          <meshStandardMaterial color="#E07030" metalness={0.3} roughness={0.7} />
        </mesh>
        
        <group position={[crane.currentRadius, -2, 0]}>
          <mesh position={[0, -liftPosition.y + towerHeight - 2, 0]}>
            <cylinderGeometry args={[0.1, 0.1, liftPosition.y - 2, 8]} />
            <meshStandardMaterial color="#888888" />
          </mesh>
          
          <mesh position={[0, -liftPosition.y + towerHeight - 4, 0]}>
            <boxGeometry args={[1.5, 1.5, 1.5]} />
            <meshStandardMaterial color="#DD4444" metalness={0.5} roughness={0.5} />
          </mesh>
          
          <mesh position={[0, -liftPosition.y + towerHeight - 6, 0]}>
            <boxGeometry args={[3, 2, 2]} />
            <meshStandardMaterial color="#4A90D9" metalness={0.3} roughness={0.6} />
          </mesh>
        </group>
      </group>
      
      <mesh position={[0, 1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1, 3, 32]} />
        <meshBasicMaterial color="#FF6B35" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

export default TowerCrane;
