import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CollisionPoint } from '../../types';
import { collisionColors } from '../../data/config';

interface CollisionMarkerProps {
  collision: CollisionPoint;
  isSelected: boolean;
  onClick: () => void;
}

export function CollisionMarker({ collision, isSelected, onClick }: CollisionMarkerProps) {
  const markerRef = useRef<THREE.Group>(null);
  const pulseRef = useRef<THREE.Mesh>(null);

  const color = useMemo(() => collisionColors[collision.severity] || '#e53935', [collision.severity]);

  const size = useMemo(() => {
    switch (collision.severity) {
      case 'critical':
        return 1.2;
      case 'warning':
        return 0.9;
      default:
        return 0.6;
    }
  }, [collision.severity]);

  useFrame((_, delta) => {
    if (markerRef.current) {
      markerRef.current.rotation.y += delta * 0.5;
    }
    if (pulseRef.current) {
      const scale = 1 + Math.sin(Date.now() * 0.003) * 0.3;
      pulseRef.current.scale.setScalar(scale);
      const material = pulseRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.6 - Math.sin(Date.now() * 0.003) * 0.4);
    }
  });

  return (
    <group
      ref={markerRef}
      position={[collision.position.x, collision.position.y, collision.position.z]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <mesh>
        <sphereGeometry args={[size * 0.5, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 1 : 0.6}
          transparent
          opacity={0.9}
        />
      </mesh>

      <mesh ref={pulseRef}>
        <ringGeometry args={[size * 0.6, size * 0.8, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {isSelected && (
        <mesh>
          <sphereGeometry args={[size * 1.2, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.15}
            side={THREE.BackSide}
            toneMapped={false}
          />
        </mesh>
      )}

      <mesh position={[0, size + 0.3, 0]}>
        <coneGeometry args={[size * 0.2, size * 0.5, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  );
}

export function CollisionMarkersGroup({
  collisions,
  visible,
  selectedCollision,
  onSelectCollision,
}: {
  collisions: CollisionPoint[];
  visible: boolean;
  selectedCollision: CollisionPoint | null;
  onSelectCollision: (collision: CollisionPoint | null) => void;
}) {
  if (!visible) return null;

  return (
    <group>
      {collisions.map((collision) => (
        <CollisionMarker
          key={collision.id}
          collision={collision}
          isSelected={selectedCollision?.id === collision.id}
          onClick={() => onSelectCollision(selectedCollision?.id === collision.id ? null : collision)}
        />
      ))}
    </group>
  );
}

export function DistanceLine({
  collision,
  visible,
}: {
  collision: CollisionPoint | null;
  visible: boolean;
}) {
  const geometry = useMemo(() => {
    if (!collision || !visible) return null;
    const points = [
      new THREE.Vector3(collision.segmentA.startPoint.x, collision.segmentA.startPoint.y, collision.segmentA.startPoint.z),
      new THREE.Vector3(collision.segmentA.endPoint.x, collision.segmentA.endPoint.y, collision.segmentA.endPoint.z),
      new THREE.Vector3(collision.segmentB.startPoint.x, collision.segmentB.startPoint.y, collision.segmentB.startPoint.z),
      new THREE.Vector3(collision.segmentB.endPoint.x, collision.segmentB.endPoint.y, collision.segmentB.endPoint.z),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [collision, visible]);

  if (!collision || !visible || !geometry) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#ffffff" linewidth={2} />
    </lineSegments>
  );
}
