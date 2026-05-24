import * as THREE from 'three';
import { DangerZone as DangerZoneType } from '../../types';

interface DangerZoneProps {
  zone: DangerZoneType;
}

const DangerZone = ({ zone }: DangerZoneProps) => {
  const getColor = () => {
    switch (zone.type) {
      case 'restricted': return zone.occupied ? '#FF4D4F' : '#FF7875';
      case 'warning': return zone.occupied ? '#FAAD14' : '#FFD666';
      case 'safe': return '#52C41A';
      default: return '#8C8C8C';
    }
  };
  
  const color = getColor();
  const opacity = zone.occupied ? 0.5 : 0.3;
  
  if (zone.shape === 'circle' && zone.radius) {
    return (
      <group position={[zone.position.x, 0.02, zone.position.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[zone.radius * 0.9, zone.radius, 64]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
        
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[zone.radius * 0.9, 64]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
        </mesh>
        
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh
            key={i}
            position={[
              (zone.radius! * 0.7) * Math.cos((i * Math.PI) / 4),
              0.05,
              (zone.radius! * 0.7) * Math.sin((i * Math.PI) / 4)
            ]}
            rotation={[-Math.PI / 2, 0, (i * Math.PI) / 4]}
          >
            <coneGeometry args={[1, 2, 4]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
    );
  }
  
  if (zone.shape === 'rectangle' && zone.dimensions) {
    const { width, depth } = zone.dimensions;
    
    return (
      <group position={[zone.position.x, 0.02, zone.position.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width, depth]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
        </mesh>
        
        <mesh position={[0, 0, depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width, 0.8]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
        <mesh position={[0, 0, -depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width, 0.8]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
        <mesh position={[width / 2, 0, 0]} rotation={[-Math.PI / 2, Math.PI / 2, 0]}>
          <planeGeometry args={[depth, 0.8]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
        <mesh position={[-width / 2, 0, 0]} rotation={[-Math.PI / 2, Math.PI / 2, 0]}>
          <planeGeometry args={[depth, 0.8]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
      </group>
    );
  }
  
  return null;
};

export default DangerZone;
