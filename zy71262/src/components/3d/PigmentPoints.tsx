import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { Pigment, STATUS_COLORS } from '../../types';
import { pigmentToCubePosition } from '../../utils/similarityCalculator';

interface PigmentPointsProps {
  pigments: Pigment[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function PigmentPoints({ pigments, selectedId, onSelect }: PigmentPointsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempColor = new THREE.Color();

  const points = useMemo(() => {
    return pigments.map(pigment => ({
      id: pigment.id,
      position: pigmentToCubePosition(pigment),
      color: STATUS_COLORS[pigment.status],
      isSelected: pigment.id === selectedId,
    }));
  }, [pigments, selectedId]);

  useFrame((state) => {
    if (meshRef.current) {
      points.forEach((point, i) => {
        const scale = point.isSelected ? 1.5 + Math.sin(state.clock.elapsedTime * 3) * 0.2 : 1;
        const matrix = new THREE.Matrix4();
        matrix.makeScale(scale, scale, scale);
        matrix.setPosition(point.position.x, point.position.y, point.position.z);
        meshRef.current!.setMatrixAt(i, matrix);
        
        tempColor.set(point.color);
        if (point.isSelected) {
          tempColor.multiplyScalar(1.3);
        }
        meshRef.current!.setColorAt(i, tempColor);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  const handlePointerMissed = () => {
    onSelect(null);
  };

  return (
    <group onPointerMissed={handlePointerMissed}>
      <Instances limit={100} ref={meshRef}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial emissiveIntensity={0.3} />
        {points.map((point) => (
          <Instance
            key={point.id}
            position={[point.position.x, point.position.y, point.position.z]}
            color={point.color}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(point.id);
            }}
          />
        ))}
      </Instances>
      
      {points.filter(p => p.isSelected).map((point) => (
        <mesh key={`glow-${point.id}`} position={[point.position.x, point.position.y, point.position.z]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color={point.color} transparent opacity={0.2} />
        </mesh>
      ))}
    </group>
  );
}
