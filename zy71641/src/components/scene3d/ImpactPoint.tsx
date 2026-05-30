import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { ImpactPoint as ImpactPointType } from '@/types';

interface ImpactPointProps {
  impactPoint?: ImpactPointType;
  visible: boolean;
  onClick?: () => void;
}

export function ImpactPoint({ impactPoint, visible, onClick }: ImpactPointProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  
  useFrame((_, delta) => {
    if (ringRef.current) {
      const scale = 1 + Math.sin(Date.now() * 0.003) * 0.2;
      ringRef.current.scale.set(scale, scale, scale);
      
      const material = ringRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.4 + Math.sin(Date.now() * 0.003) * 0.2;
    }
    
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
    }
  });
  
  if (!visible) return null;
  
  if (!impactPoint) {
    return (
      <group position={[0, 0.02, 0]} onClick={onClick}>
        <mesh>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color="#FF3366" transparent opacity={0.3} />
        </mesh>
        <Text
          position={[0, 0.12, 0]}
          fontSize={0.1}
          color="#FF3366"
          anchorX="center"
          anchorY="middle"
        >
          ?
        </Text>
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.08, 0.12, 32]} />
          <meshBasicMaterial color="#FF3366" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }
  
  const { position, faceAngle, velocity, isSupplemented } = impactPoint;
  const mainColor = isSupplemented ? '#FF8800' : '#00FF88';
  const glowColor = isSupplemented ? 'rgba(255, 136, 0, 0.3)' : 'rgba(0, 255, 136, 0.3)';
  
  return (
    <group 
      ref={groupRef} 
      position={[position.x, position.y, position.z]} 
      onClick={onClick}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.15, 64]} />
        <meshBasicMaterial color={mainColor} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.18, 64]} />
        <meshBasicMaterial color={mainColor} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      
      <mesh>
        <sphereGeometry args={[0.04, 24, 24]} />
        <meshStandardMaterial 
          color={mainColor} 
          emissive={mainColor}
          emissiveIntensity={0.5}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      
      <mesh position={[0, 0, 0.2]} rotation={[0, 0, -faceAngle * (Math.PI / 180)]}>
        <coneGeometry args={[0.02, 0.15, 8]} />
        <meshBasicMaterial color="#00AAFF" />
      </mesh>
      
      <mesh position={[0.25, 0.05, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.5, 0.2]} />
        <meshBasicMaterial color="#0B0F17" transparent opacity={0.8} />
      </mesh>
      
      {isSupplemented && (
        <mesh position={[0.1, 0.12, 0]}>
          <planeGeometry args={[0.12, 0.05]} />
          <meshBasicMaterial color="#FF8800" />
        </mesh>
      )}
    </group>
  );
}
