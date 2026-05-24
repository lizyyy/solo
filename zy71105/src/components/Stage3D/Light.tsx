import { useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Light } from '../../types';
import LightBeam from './LightBeam';
import { useSceneStore } from '../../store/useSceneStore';
import { isLightInCollision } from '../../services/collision';

interface LightComponentProps {
  light: Light;
  isSelected: boolean;
  onPositionDrag: (position: THREE.Vector3) => void;
  onTargetDrag: (position: THREE.Vector3) => void;
}

export default function LightComponent({
  light,
  isSelected,
  onPositionDrag,
  onTargetDrag
}: LightComponentProps) {
  const setSelectedLight = useSceneStore((state) => state.setSelectedLight);
  const collisionWarnings = useSceneStore((state) => state.collisionWarnings);
  const { camera, gl } = useThree();
  
  const [isDragging, setIsDragging] = useState<'position' | 'target' | null>(null);
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  const hasCollision = isLightInCollision(light.id, collisionWarnings);

  const handlePointerDown = (type: 'position' | 'target') => (e: any) => {
    e.stopPropagation();
    setIsDragging(type);
    setSelectedLight(light.id);
    
    const point = type === 'position' 
      ? new THREE.Vector3(light.position.x, light.position.y, light.position.z)
      : new THREE.Vector3(light.target.x, light.target.y, light.target.z);
    
    dragPlaneRef.current.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      point
    );
    
    gl.domElement.style.cursor = 'grabbing';
  };

  const handlePointerMove = (e: any) => {
    if (!isDragging) return;
    
    const rect = gl.domElement.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, camera);
    
    const intersectPoint = new THREE.Vector3();
    raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersectPoint);
    
    if (intersectPoint) {
      if (isDragging === 'position') {
        onPositionDrag(intersectPoint);
      } else {
        onTargetDrag(intersectPoint);
      }
    }
  };

  const handlePointerUp = () => {
    setIsDragging(null);
    gl.domElement.style.cursor = 'default';
  };

  const lightColor = new THREE.Color(light.color);

  return (
    <group>
      <LightBeam light={light} />

      <group position={[light.position.x, light.position.y, light.position.z]}>
        <mesh
          onPointerDown={handlePointerDown('position')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <cylinderGeometry args={[0.15, 0.2, 0.3, 16]} />
          <meshStandardMaterial
            color={isSelected ? '#0066ff' : hasCollision ? '#ff3b30' : '#3a3a3e'}
            emissive={isSelected ? '#003366' : '#1a1a1e'}
            emissiveIntensity={0.5}
          />
        </mesh>
        
        <mesh position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.1, 16]} />
          <meshStandardMaterial
            color={light.color}
            emissive={light.color}
            emissiveIntensity={light.enabled ? light.intensity * 0.5 : 0}
          />
        </mesh>

        {isSelected && (
          <mesh position={[0, 0.25, 0]}>
            <ringGeometry args={[0.25, 0.3, 32]} />
            <meshBasicMaterial color="#0066ff" side={THREE.DoubleSide} transparent opacity={0.6} />
          </mesh>
        )}
      </group>

      {isSelected && (
        <group position={[light.target.x, light.target.y, light.target.z]}>
          <mesh
            onPointerDown={handlePointerDown('target')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshBasicMaterial color="#0066ff" transparent opacity={0.6} />
          </mesh>
          <mesh>
            <ringGeometry args={[0.15, 0.2, 32]} />
            <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.4} />
          </mesh>
        </group>
      )}

      {light.enabled && isSelected && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([
                light.position.x, light.position.y, light.position.z,
                light.target.x, light.target.y, light.target.z
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#0066ff" transparent opacity={0.3} />
        </line>
      )}

      <pointLight
        position={[light.position.x, light.position.y - 0.2, light.position.z]}
        color={light.color}
        intensity={light.enabled ? light.intensity * 0.3 : 0}
        distance={15}
      />
    </group>
  );
}
