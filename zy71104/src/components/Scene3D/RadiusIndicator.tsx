import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { calculateMaxWeightForRadius } from '../../utils/cranePhysics';

const RadiusIndicator = () => {
  const { crane, liftObject, risks } = useSceneStore();
  
  const hasRadiusRisk = risks.some(r => r.type === 'radius_exceeded');
  const hasWeightRisk = risks.some(r => r.type === 'weight_exceeded');
  
  const maxAllowedWeightAtCurrentRadius = calculateMaxWeightForRadius(crane, crane.currentRadius);
  const isOverweight = liftObject.weight > maxAllowedWeightAtCurrentRadius;
  
  const baseColor = hasRadiusRisk || isOverweight ? '#FF4D4F' : '#165DFF';
  
  const angleRad = (crane.currentAngle * Math.PI) / 180;
  const endX = crane.position.x + crane.currentRadius * Math.sin(angleRad);
  const endZ = crane.position.z + crane.currentRadius * Math.cos(angleRad);
  
  const curvePoints = [];
  for (let i = 0; i <= 50; i++) {
    const t = (i / 50) * (crane.currentAngle * Math.PI) / 180;
    curvePoints.push(
      crane.position.x + crane.currentRadius * Math.sin(t),
      0.1,
      crane.position.z + crane.currentRadius * Math.cos(t)
    );
  }
  
  return (
    <group position={[crane.position.x, 0, crane.position.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[crane.maxRadius - 0.3, crane.maxRadius, 128]} />
        <meshBasicMaterial 
          color={hasRadiusRisk ? '#FF4D4F' : '#165DFF'} 
          transparent 
          opacity={0.8} 
          side={THREE.DoubleSide} 
        />
      </mesh>
      
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[crane.minRadius - 0.2, crane.minRadius, 64]} />
        <meshBasicMaterial color="#FAAD14" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([0, crane.height, 0, endX - crane.position.x, crane.height, endZ - crane.position.z])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={baseColor} linewidth={3} />
      </line>
      
      <mesh position={[endX - crane.position.x, 0.1, endZ - crane.position.z]}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshBasicMaterial 
          color={hasWeightRisk ? '#FF4D4F' : '#165DFF'} 
          transparent 
          opacity={0.9} 
        />
      </mesh>
      
      <group position={[endX - crane.position.x, 3, endZ - crane.position.z]}>
        <mesh>
          <planeGeometry args={[6, 2.5]} />
          <meshBasicMaterial color="#1F1F1F" transparent opacity={0.9} />
        </mesh>
      </group>
    </group>
  );
};

export default RadiusIndicator;
