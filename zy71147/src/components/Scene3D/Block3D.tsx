
import React, { useRef, useState } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Block, Vector3 } from '../../types';

interface Block3DProps {
  block: Block;
  isSelected: boolean;
  currentPosition: Vector3;
  onSelect: (id: string) => void;
  showLiftingPoints: boolean;
  onDrag?: (blockId: string, position: { x: number; y: number; z: number }) => void;
}

export const Block3D: React.FC<Block3DProps> = ({
  block,
  isSelected,
  currentPosition,
  onSelect,
  showLiftingPoints,
  onDrag,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { camera, raycaster, pointer } = useThree();
  const dragPlane = useRef(new THREE.Plane());
  const dragOffset = useRef(new THREE.Vector3());
  const intersectPoint = useRef(new THREE.Vector3());

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect(block.id);
    
    if (onDrag && e.button === 0) {
      setIsDragging(true);
      
      const planeNormal = new THREE.Vector3(0, 1, 0);
      const planePoint = new THREE.Vector3(
        currentPosition.x,
        currentPosition.y,
        currentPosition.z
      );
      dragPlane.current.setFromNormalAndCoplanarPoint(planeNormal, planePoint);
      
      const mouse = new THREE.Vector2(pointer.x, pointer.y);
      raycaster.setFromCamera(mouse, camera);
      
      if (raycaster.ray.intersectPlane(dragPlane.current, intersectPoint.current)) {
        dragOffset.current.copy(intersectPoint.current).sub(
          new THREE.Vector3(currentPosition.x, currentPosition.y, currentPosition.z)
        );
      }
      
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging || !onDrag) return;
    e.stopPropagation();
    
    const mouse = new THREE.Vector2(pointer.x, pointer.y);
    raycaster.setFromCamera(mouse, camera);
    
    if (raycaster.ray.intersectPlane(dragPlane.current, intersectPoint.current)) {
      const newPosition = intersectPoint.current.sub(dragOffset.current);
      onDrag(block.id, {
        x: newPosition.x,
        y: currentPosition.y,
        z: newPosition.z,
      });
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (isDragging) {
      setIsDragging(false);
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
  };

  const edgeColor = isSelected ? '#FFD700' : '#1a1a2e';
  const bodyColor = isSelected ? adjustColor(block.color, 30) : block.color;

  return (
    <group position={[currentPosition.x, currentPosition.y, currentPosition.z]}>
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <boxGeometry args={[block.dimensions.width, block.dimensions.height, block.dimensions.depth]} />
        <meshStandardMaterial
          color={bodyColor}
          metalness={0.3}
          roughness={0.7}
          transparent
          opacity={0.9}
        />
      </mesh>

      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(block.dimensions.width, block.dimensions.height, block.dimensions.depth)]} />
        <lineBasicMaterial color={edgeColor} linewidth={2} />
      </lineSegments>

      {showLiftingPoints && block.liftingPoints.map((lp) => (
        <group key={lp.id} position={[lp.position.x, lp.position.y, lp.position.z]}>
          <mesh>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial
              color={lp.isValid ? '#00B42A' : '#F53F3F'}
              emissive={lp.isValid ? '#00B42A' : '#F53F3F'}
              emissiveIntensity={0.3}
            />
          </mesh>
          <mesh position={[lp.direction.x * 0.8, lp.direction.y * 0.8, lp.direction.z * 0.8]}>
            <coneGeometry args={[0.15, 0.5, 8]} />
            <meshStandardMaterial color={lp.isValid ? '#00B42A' : '#F53F3F'} />
          </mesh>
        </group>
      ))}

      {isDragging && (
        <mesh position={[0, -0.05, 0]}>
          <ringGeometry args={[Math.max(block.dimensions.width, block.dimensions.depth) * 0.6, Math.max(block.dimensions.width, block.dimensions.depth) * 0.65, 32]} />
          <meshBasicMaterial color="#FFD700" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};

function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + amount);
  const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

