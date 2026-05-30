import { useRef, useMemo, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { Microphone as MicrophoneType, Position3D } from '@/types';
import { useDrumKitStore } from '@/store/useDrumKitStore';
import { getPolarPatternGain } from '@/utils/acousticMath';
import { COLORS } from '@/utils/constants';

interface Microphone3DProps {
  mic: MicrophoneType;
  onPointerDown: (event: PointerEvent, micId: string, position: Position3D) => void;
  isDragging: boolean;
}

export function Microphone3D({ mic, onPointerDown, isDragging }: Microphone3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const { selectedMicId, selectMicrophone, analysis } = useDrumKitStore();
  const [isHovered, setIsHovered] = useState(false);
  const isSelected = selectedMicId === mic.id;
  
  const micErrors = analysis.errors.filter(e => e.sourceId === mic.id);
  const hasError = micErrors.some(e => e.severity === 'error');
  const hasWarning = micErrors.some(e => e.severity === 'warning');
  
  const statusColor = useMemo(() => {
    if (isSelected) return COLORS.accent;
    if (hasError) return COLORS.error;
    if (hasWarning) return COLORS.warning;
    return '#10b981';
  }, [isSelected, hasError, hasWarning]);
  
  const materials = useMemo(() => {
    const body = new THREE.MeshStandardMaterial({
      color: '#2a2a2a',
      metalness: 0.9,
      roughness: 0.3,
    });
    
    const grille = new THREE.MeshStandardMaterial({
      color: '#444444',
      metalness: 0.8,
      roughness: 0.4,
      transparent: true,
      opacity: 0.8,
    });
    
    const glow = new THREE.MeshBasicMaterial({
      color: statusColor,
      transparent: true,
      opacity: 0.6,
    });
    
    const wire = new THREE.MeshBasicMaterial({
      color: '#666666',
    });
    
    return { body, grille, glow, wire };
  }, [statusColor]);
  
  useFrame((state) => {
    if (bodyRef.current && isSelected) {
      const material = bodyRef.current.material as THREE.MeshStandardMaterial;
      material.emissive = new THREE.Color(statusColor);
      material.emissiveIntensity = 0.2 + Math.sin(state.clock.elapsedTime * 4) * 0.15;
    } else if (bodyRef.current) {
      const material = bodyRef.current.material as THREE.MeshStandardMaterial;
      material.emissive = new THREE.Color(0, 0, 0);
      material.emissiveIntensity = 0;
    }
    
    if (groupRef.current && isDragging) {
      groupRef.current.position.y += Math.sin(state.clock.elapsedTime * 10) * 0.002;
    }
  });
  
  const renderPolarPattern = () => {
    if (!isSelected && !isHovered) return null;
    
    const segments = 32;
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const gain = Math.max(0.1, Math.pow(10, getPolarPatternGain(mic.polarPattern, angle) / 20));
      const radius = gain * 0.3;
      points.push(new THREE.Vector3(
        Math.sin(angle) * radius,
        0,
        -Math.cos(angle) * radius
      ));
    }
    
    return (
      <Line
        points={points}
        color={statusColor}
        transparent
        opacity={0.5}
      />
    );
  };
  
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    selectMicrophone(mic.id);
    onPointerDown(e.nativeEvent, mic.id, mic.position);
  };
  
  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setIsHovered(true);
    document.body.style.cursor = 'grab';
  };
  
  const handlePointerOut = () => {
    setIsHovered(false);
    if (!isDragging) {
      document.body.style.cursor = 'auto';
    }
  };
  
  return (
    <group
      ref={groupRef}
      position={[mic.position.x, mic.position.y, mic.position.z]}
      rotation={[mic.rotation.x, mic.rotation.y, mic.rotation.z]}
      onPointerDown={handlePointerDown}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <mesh ref={bodyRef} position={[0, 0, -0.08]}>
        <cylinderGeometry args={[0.03, 0.035, 0.2, 16]} />
        <primitive object={materials.body} attach="material" />
      </mesh>
      
      <mesh position={[0, 0, 0.05]}>
        <sphereGeometry args={[0.035, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <primitive object={materials.grille} attach="material" />
      </mesh>
      
      <mesh position={[0, 0, 0.18]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <primitive object={materials.glow} attach="material" />
      </mesh>
      
      <mesh position={[0, 0, -0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.02, 0.005, 8, 16]} />
        <primitive object={materials.wire} attach="material" />
      </mesh>
      
      <mesh position={[0, -0.15, -0.22]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.005, 0.3, 0.005]} />
        <primitive object={materials.wire} attach="material" />
      </mesh>
      
      {renderPolarPattern()}
      
      {isSelected && (
        <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.05, 0.07, 32]} />
          <meshBasicMaterial color={statusColor} side={THREE.DoubleSide} />
        </mesh>
      )}
      
      {mic.phaseInverted && (
        <mesh position={[0, 0.35, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color={COLORS.warning} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}
