import { useView3DStore } from '@/store/useView3DStore';
import * as THREE from 'three';

export const SectionPlane = () => {
  const { sectionPlane } = useView3DStore();

  if (!sectionPlane.axis) return null;

  const size = 5;
  const position = sectionPlane.position;

  const getPlaneRotation = () => {
    switch (sectionPlane.axis) {
      case 'x':
        return [0, 0, Math.PI / 2];
      case 'y':
        return [Math.PI / 2, 0, 0];
      case 'z':
        return [0, 0, 0];
      default:
        return [0, 0, 0];
    }
  };

  const getPlanePosition = () => {
    switch (sectionPlane.axis) {
      case 'x':
        return [position, 0, 0];
      case 'y':
        return [0, position, 0];
      case 'z':
        return [0, 0, position];
      default:
        return [0, 0, 0];
    }
  };

  const rotation = getPlaneRotation();
  const pos = getPlanePosition();

  return (
    <group>
      <mesh position={pos as [number, number, number]} rotation={rotation as [number, number, number]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial 
          color="#3b82f6" 
          transparent 
          opacity={0.15} 
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={pos as [number, number, number]} rotation={rotation as [number, number, number]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial 
          color="#60a5fa" 
          transparent 
          opacity={0.3} 
          side={THREE.DoubleSide}
          wireframe
        />
      </mesh>

      <group position={pos as [number, number, number]}>
        <mesh rotation={[0, 0, 0]}>
          <torusGeometry args={[0.15, 0.02, 8, 16]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      </group>
    </group>
  );
};
