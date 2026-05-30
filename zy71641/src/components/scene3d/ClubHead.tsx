import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SwingFrame, Anomaly } from '@/types';
import { lerpVector } from '@/utils/swingMath';

interface ClubHeadProps {
  frames: SwingFrame[];
  currentFrameIndex: number;
  anomalies: Anomaly[];
  visible: boolean;
  isPlaying: boolean;
  showTrail?: boolean;
  onDrag?: (position: { x: number; y: number; z: number }) => void;
}

export function ClubHead({ 
  frames, 
  currentFrameIndex, 
  anomalies,
  visible,
  isPlaying,
  showTrail = true,
  onDrag,
}: ClubHeadProps) {
  const groupRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Points>(null);
  const trailPositions = useRef<Float32Array>(new Float32Array(60));
  
  const currentFrame = frames[currentFrameIndex];
  const nextFrame = frames[Math.min(currentFrameIndex + 1, frames.length - 1)];
  
  const hasFaceAngleAnomaly = useMemo(() => {
    if (!currentFrame) return false;
    return anomalies.some(a => 
      a.type === 'faceAngleReverse' && 
      (a.frameId === currentFrame.frameId || 
       (a.frameRange && currentFrameIndex >= a.frameRange.start && currentFrameIndex <= a.frameRange.end))
    );
  }, [anomalies, currentFrame, currentFrameIndex]);
  
  const interpolatedPosition = useMemo(() => {
    if (!currentFrame) return { x: 0, y: 0, z: 0 };
    if (!nextFrame || !isPlaying) return currentFrame.position;
    
    const progress = (Date.now() % 16) / 16;
    return lerpVector(currentFrame.position, nextFrame.position, progress);
  }, [currentFrame, nextFrame, isPlaying]);
  
  const interpolatedRotation = useMemo(() => {
    if (!currentFrame) return { x: 0, y: 0, z: 0 };
    if (!nextFrame || !isPlaying) return currentFrame.faceAngle;
    
    const progress = (Date.now() % 16) / 16;
    return lerpVector(currentFrame.faceAngle, nextFrame.faceAngle, progress);
  }, [currentFrame, nextFrame, isPlaying]);
  
  useFrame((_, delta) => {
    if (groupRef.current && currentFrame) {
      groupRef.current.position.set(
        interpolatedPosition.x,
        interpolatedPosition.y,
        interpolatedPosition.z
      );
      
      groupRef.current.rotation.set(
        interpolatedRotation.x,
        interpolatedRotation.y,
        interpolatedRotation.z
      );
    }
    
    if (trailRef.current && showTrail && currentFrame) {
      const positions = trailPositions.current;
      for (let i = positions.length - 3; i >= 3; i -= 3) {
        positions[i] = positions[i - 3];
        positions[i + 1] = positions[i - 2];
        positions[i + 2] = positions[i - 1];
      }
      positions[0] = interpolatedPosition.x;
      positions[1] = interpolatedPosition.y;
      positions[2] = interpolatedPosition.z;
      
      (trailRef.current.geometry as THREE.BufferGeometry).attributes.position.needsUpdate = true;
    }
  });
  
  if (!visible || !currentFrame) return null;
  
  const clubColor = hasFaceAngleAnomaly ? '#FF3366' : '#C0C0C0';
  const faceColor = hasFaceAngleAnomaly ? '#FF3366' : '#E8E8E8';
  
  const trailGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(trailPositions.current, 3));
    return geometry;
  }, []);
  
  return (
    <group ref={groupRef}>
      {showTrail && (
        <points ref={trailRef} geometry={trailGeometry}>
          <pointsMaterial 
            color="#00FF88" 
            size={0.02} 
            transparent 
            opacity={0.4}
            sizeAttenuation
          />
        </points>
      )}
      
      <group>
        <mesh position={[0, 0, -0.05]}>
          <cylinderGeometry args={[0.01, 0.015, 0.3, 12]} />
          <meshStandardMaterial 
            color="#8B4513" 
            metalness={0.3} 
            roughness={0.7}
          />
        </mesh>
        
        <mesh position={[0, 0, 0.08]}>
          <boxGeometry args={[0.12, 0.06, 0.1]} />
          <meshStandardMaterial 
            color={clubColor} 
            metalness={0.9} 
            roughness={0.2}
          />
        </mesh>
        
        <mesh position={[0, 0.001, 0.131]}>
          <planeGeometry args={[0.11, 0.05]} />
          <meshStandardMaterial 
            color={faceColor} 
            metalness={0.95} 
            roughness={0.1}
            emissive={hasFaceAngleAnomaly ? '#FF3366' : '#000000'}
            emissiveIntensity={hasFaceAngleAnomaly ? 0.3 : 0}
          />
        </mesh>
        
        <mesh position={[0, 0, 0.15]} rotation={[0, 0, 0]}>
          <coneGeometry args={[0.015, 0.08, 8]} />
          <meshBasicMaterial color="#00AAFF" transparent opacity={0.8} />
        </mesh>
      </group>
      
      {hasFaceAngleAnomaly && (
        <mesh position={[0, 0.15, 0]}>
          <ringGeometry args={[0.05, 0.07, 32]} />
          <meshBasicMaterial 
            color="#FF3366" 
            transparent 
            opacity={0.5 + Math.sin(Date.now() * 0.01) * 0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}
