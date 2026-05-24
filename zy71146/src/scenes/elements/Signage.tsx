import { useRef, useState } from 'react';
import { Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Signage as SignageType } from '@/types';
import { useSceneStore } from '@/store/sceneStore';
import { useAnalysisStore } from '@/store/analysisStore';

interface SignageProps {
  data: SignageType;
  onClick?: () => void;
}

export function Signage({ data, onClick }: SignageProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const selectedElement = useSceneStore(state => state.selectedElement);
  const visibilityResults = useAnalysisStore(state => state.visibilityResults);
  const visibilityCheckEnabled = useAnalysisStore(state => state.visibilityCheckEnabled);
  
  const isSelected = selectedElement === data.id;
  const visibilityResult = visibilityResults.find(r => r.signageId === data.id);
  const isVisible = visibilityCheckEnabled ? visibilityResult?.isVisible ?? true : true;

  useFrame(() => {
    if (meshRef.current) {
    }
  });

  const rotation = data.rotation || [0, 0, 0];
  const bgColor = isSelected ? '#ff9800' : (isVisible ? '#1976d2' : '#f44336');

  return (
    <group position={data.position} rotation={rotation as [number, number, number]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
      >
        <boxGeometry args={[3, 1.2, 0.1]} />
        <meshStandardMaterial
          color={bgColor}
          emissive={hovered || isSelected ? bgColor : '#000'}
          emissiveIntensity={hovered || isSelected ? 0.3 : 0}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>
      
      <Text
        position={[0, 0, 0.06]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {data.text}
      </Text>
      
      <mesh position={[0, -0.8, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.6, 8]} />
        <meshStandardMaterial color="#455a64" metalness={0.7} roughness={0.3} />
      </mesh>
      
      {!isVisible && visibilityCheckEnabled && (
        <mesh position={[0, 1, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshBasicMaterial color="#f44336" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}
