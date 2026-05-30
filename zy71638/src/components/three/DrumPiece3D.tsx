import { useRef, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { DrumPiece as DrumPieceType } from '@/types';
import { DRUM_PIECE_NAMES } from '@/utils/constants';
import { getDrumPieceRadius } from '@/utils/acousticMath';
import { useDrumKitStore } from '@/store/useDrumKitStore';

interface DrumPiece3DProps {
  piece: DrumPieceType;
}

export function DrumPiece3D({ piece }: DrumPiece3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { selectedDrumId, selectDrumPiece, selectedMicId } = useDrumKitStore();
  const isSelected = selectedDrumId === piece.id;
  const hasMicSelected = !!selectedMicId;
  
  const radius = getDrumPieceRadius(piece.type);
  
  const materials = useMemo(() => {
    const drumShell = new THREE.MeshStandardMaterial({
      color: '#4a3728',
      metalness: 0.3,
      roughness: 0.7,
    });
    
    const drumHead = new THREE.MeshStandardMaterial({
      color: '#f5f5f5',
      metalness: 0.1,
      roughness: 0.5,
    });
    
    const cymbal = new THREE.MeshStandardMaterial({
      color: '#e8c872',
      metalness: 0.9,
      roughness: 0.2,
    });
    
    const hardware = new THREE.MeshStandardMaterial({
      color: '#888888',
      metalness: 0.8,
      roughness: 0.3,
    });
    
    const selected = new THREE.MeshStandardMaterial({
      color: '#3b82f6',
      emissive: '#3b82f6',
      emissiveIntensity: 0.3,
      metalness: 0.5,
      roughness: 0.5,
    });
    
    return { drumShell, drumHead, cymbal, hardware, selected };
  }, []);
  
  useFrame((state) => {
    if (!groupRef.current) return;
    if (isSelected) {
      groupRef.current.children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.emissiveIntensity = 0.2 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
        }
      });
    }
  });
  
  const renderDrum = () => {
    const shellMaterial = isSelected ? materials.selected : materials.drumShell;
    const headMaterial = isSelected ? materials.selected : materials.drumHead;
    
    if (piece.type === 'kick') {
      return (
        <group>
          <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[radius, radius, 0.5, 32]} />
            <primitive object={shellMaterial} attach="material" />
          </mesh>
          <mesh position={[0, 0, 0.26]} rotation={[0, 0, Math.PI / 2]}>
            <circleGeometry args={[radius - 0.02, 32]} />
            <primitive object={headMaterial} attach="material" />
          </mesh>
          <mesh position={[0, 0, -0.26]} rotation={[0, 0, -Math.PI / 2]}>
            <circleGeometry args={[radius - 0.02, 32]} />
            <primitive object={headMaterial} attach="material" />
          </mesh>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.08, 0.3, 0.08]} />
            <primitive object={materials.hardware} attach="material" />
          </mesh>
        </group>
      );
    }
    
    if (piece.type === 'snare' || piece.type === 'tom1' || piece.type === 'tom2' || piece.type === 'floorTom') {
      const height = piece.type === 'snare' ? 0.18 : piece.type === 'floorTom' ? 0.3 : 0.25;
      return (
        <group>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[radius, radius, height, 32]} />
            <primitive object={shellMaterial} attach="material" />
          </mesh>
          <mesh position={[0, height / 2 + 0.01, 0]}>
            <circleGeometry args={[radius - 0.02, 32]} />
            <primitive object={headMaterial} attach="material" />
          </mesh>
          <mesh position={[0, -height / 2 - 0.01, 0]} rotation={[Math.PI, 0, 0]}>
            <circleGeometry args={[radius - 0.02, 32]} />
            <primitive object={headMaterial} attach="material" />
          </mesh>
          {piece.type === 'floorTom' && (
            <>
              <mesh position={[radius * 0.6, -0.4, radius * 0.6]}>
                <cylinderGeometry args={[0.03, 0.03, 0.5, 12]} />
                <primitive object={materials.hardware} attach="material" />
              </mesh>
              <mesh position={[-radius * 0.6, -0.4, radius * 0.6]}>
                <cylinderGeometry args={[0.03, 0.03, 0.5, 12]} />
                <primitive object={materials.hardware} attach="material" />
              </mesh>
            </>
          )}
        </group>
      );
    }
    
    if (piece.type === 'hihat' || piece.type === 'crash' || piece.type === 'ride') {
      const cymbalMaterial = isSelected ? materials.selected : materials.cymbal;
      const thickness = piece.type === 'hihat' ? 0.02 : 0.015;
      
      if (piece.type === 'hihat') {
        return (
          <group>
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[radius, radius * 0.95, thickness, 32]} />
              <primitive object={cymbalMaterial} attach="material" />
            </mesh>
            <mesh position={[0, -0.02, 0]}>
              <cylinderGeometry args={[radius, radius * 0.95, thickness, 32]} />
              <primitive object={cymbalMaterial} attach="material" />
            </mesh>
            <mesh position={[0, -0.5, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 1, 12]} />
              <primitive object={materials.hardware} attach="material" />
            </mesh>
            <mesh position={[0, -1, 0]}>
              <cylinderGeometry args={[0.15, 0.15, 0.05, 16]} />
              <primitive object={materials.hardware} attach="material" />
            </mesh>
          </group>
        );
      }
      
      return (
        <group>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[radius, radius * 0.3, thickness, 32]} />
            <primitive object={cymbalMaterial} attach="material" />
          </mesh>
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.6, 12]} />
            <primitive object={materials.hardware} attach="material" />
          </mesh>
        </group>
      );
    }
    
    return null;
  };
  
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!hasMicSelected) {
      e.stopPropagation();
      selectDrumPiece(isSelected ? null : piece.id);
    }
  };
  
  return (
    <group
      ref={groupRef}
      position={[piece.position.x, piece.position.y, piece.position.z]}
      rotation={[0, piece.rotationY, 0]}
      onClick={handleClick}
    >
      {renderDrum()}
      <mesh position={[0, radius + 0.3, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color={isSelected ? '#3b82f6' : '#64748b'} />
      </mesh>
    </group>
  );
}
