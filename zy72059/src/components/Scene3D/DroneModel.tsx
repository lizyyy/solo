import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Drone as DroneType } from '@/types';
import { STATUS_COLORS } from '@/types';

interface DroneModelProps {
  drone: DroneType;
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

export function DroneModel({ drone, isSelected, isFocused, onClick, onDoubleClick }: DroneModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const baseColor = STATUS_COLORS[drone.status];

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.position.y = drone.position.y + Math.sin(state.clock.elapsedTime * 2 + drone.position.x) * 0.15;
      
      if (isSelected) {
        groupRef.current.rotation.y += delta * 0.5;
      }
    }
  });

  const pulseScale = useMemo(() => {
    return hovered || isSelected ? 1.15 : 1;
  }, [hovered, isSelected]);

  const distanceLine = useMemo(() => {
    if (drone.obstacleDistance < 0 || isNaN(drone.obstacleDistance)) return null;
    
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -drone.position.y - drone.obstacleDistance * 0.5, 0),
    ];
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: new THREE.Color(baseColor),
      linewidth: 2,
      dashSize: 0.5,
      gapSize: 0.3,
      transparent: true,
      opacity: 0.7,
    });
    
    return { geometry, material };
  }, [drone.obstacleDistance, drone.position.y, baseColor]);

  return (
    <group
      ref={groupRef}
      position={[drone.position.x, drone.position.y, drone.position.z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
      scale={pulseScale}
    >
      <mesh>
        <boxGeometry args={[1.2, 0.6, 1.2]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={isSelected ? 0.8 : hovered ? 0.5 : 0.2}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      {[-0.6, 0.6].map((x, i) =>
        [-0.6, 0.6].map((z, j) => (
          <mesh key={`prop-${i}-${j}`} position={[x, 0.4, z]}>
            <cylinderGeometry args={[0.35, 0.35, 0.05, 8]} />
            <meshStandardMaterial
              color={0x334155}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        ))
      )}

      <mesh position={[0, 0.1, 0.65]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial
          color={0x1e88e5}
          emissive={0x1e88e5}
          emissiveIntensity={0.5}
        />
      </mesh>

      {isSelected && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.5, 0.9, 1.5]} />
          <meshBasicMaterial
            color={0xffc107}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(1.5, 0.9, 1.5)]} />
          <lineBasicMaterial
            color={0xffc107}
            transparent
            opacity={0.9}
          />
        </lineSegments>
      )}

      {(drone.status === 'WARNING' || drone.status === 'CONFIRM' || drone.status === 'ERROR' || drone.status === 'BOUNDARY') && (
        <pointLight
          color={baseColor}
          intensity={isSelected ? 3 : 1.5}
          distance={8}
          decay={2}
        />
      )}

      {distanceLine && (
        <primitive object={distanceLine} />
      )}
    </group>
  );
}
