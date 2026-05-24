import { useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { Sprinkler as SprinklerType, Environment } from '../types';
import { useStore } from '../store/useStore';
import { calculateEffectiveRadius } from '../utils/coverage';

interface SprinklerProps {
  sprinkler: SprinklerType;
  isSelected: boolean;
}

export function Sprinkler({ sprinkler, isSelected }: SprinklerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [isDragging, setIsDragging] = useState(false);

  const environment = useStore((state) => state.environment);
  const showRanges = useStore((state) => state.showSprinklerRanges);
  const updateSprinkler = useStore((state) => state.updateSprinkler);
  const setSelected = useStore((state) => state.setSelectedSprinkler);
  const field = useStore((state) => state.field);

  const { id, x, z, radius, pressure } = sprinkler;
  const { slope, slopeDirection } = environment;

  const elevation = useMemo(() => {
    const slopeRad = (slope * Math.PI) / 180;
    const dirRad = (slopeDirection * Math.PI) / 180;
    const proj = x * Math.cos(dirRad) + z * Math.sin(dirRad);
    return proj * Math.tan(slopeRad) + 0.3;
  }, [x, z, slope, slopeDirection]);

  const rangeGeometry = useMemo(() => {
    const segments = 64;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * 360;
      const effectiveRadius = calculateEffectiveRadius(sprinkler, environment, angle);
      const rad = (angle * Math.PI) / 180;

      const px = x + Math.cos(rad) * effectiveRadius;
      const pz = z + Math.sin(rad) * effectiveRadius;

      const slopeRad = (slope * Math.PI) / 180;
      const dirRad = (slopeDirection * Math.PI) / 180;
      const proj = px * Math.cos(dirRad) + pz * Math.sin(dirRad);
      const py = proj * Math.tan(slopeRad) + 0.05;

      points.push(new THREE.Vector3(px, py, pz));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [x, z, radius, pressure, environment, slope, slopeDirection]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setSelected(id);
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging || !meshRef.current) return;
    e.stopPropagation();

    const point = e.point;
    const halfW = field.width / 2;
    const halfH = field.height / 2;

    const newX = Math.max(-halfW, Math.min(halfW, point.x));
    const newZ = Math.max(-halfH, Math.min(halfH, point.z));

    updateSprinkler(id, { x: newX, z: newZ });
  };

  const baseColor = isSelected ? 0xffd700 : 0x2196f3;

  return (
    <group ref={groupRef} position={[x, elevation, z]}>
      {showRanges && (
        <>
          <primitive
            object={
              new THREE.Line(
                rangeGeometry,
                new THREE.LineBasicMaterial({
                  color: isSelected ? 0xffd700 : 0x2196f3,
                  linewidth: 2,
                })
              )
            }
          />
          <mesh>
            <shapeGeometry args={[createRangeShape(sprinkler, environment)]} />
            <meshBasicMaterial
              color={isSelected ? 0xffd700 : 0x2196f3}
              transparent
              opacity={0.15}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}

      <mesh
        ref={meshRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerUp}
        castShadow
      >
        <cylinderGeometry args={[0.2, 0.3, 0.6, 16]} />
        <meshStandardMaterial color={baseColor} metalness={0.3} roughness={0.5} />
      </mesh>

      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 0.2, 16]} />
        <meshStandardMaterial color={0x666666} metalness={0.8} roughness={0.2} />
      </mesh>

      {isSelected && (
        <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.5, 32]} />
          <meshBasicMaterial color={0xffd700} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function createRangeShape(
  sprinkler: SprinklerType,
  environment: Environment
): THREE.Shape {
  const shape = new THREE.Shape();
  const segments = 64;

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 360;
    const effectiveRadius = calculateEffectiveRadius(sprinkler, environment, angle);
    const rad = (angle * Math.PI) / 180;

    const px = Math.cos(rad) * effectiveRadius;
    const pz = Math.sin(rad) * effectiveRadius;

    if (i === 0) {
      shape.moveTo(px, pz);
    } else {
      shape.lineTo(px, pz);
    }
  }

  return shape;
}
