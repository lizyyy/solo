import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Building } from '../../data/types';
import { ANOMALY_COLORS, SUNLIGHT_STANDARD } from '../../data/types';
import { useUserMarker } from '../../store/useSandboxStore';

interface BuildingMeshProps {
  building: Building;
  isSelected: boolean;
  isFiltered: boolean;
  onClick: () => void;
}

export function BuildingMesh({
  building,
  isSelected,
  isFiltered,
  onClick,
}: BuildingMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);
  const [hovered, setHovered] = useState(false);
  const marker = useUserMarker(building.id);

  const baseColor = useMemo(() => {
    if (!isFiltered) return new THREE.Color(0x2a3a4a);
    if (building.anomalies.includes('cross_floor')) {
      return new THREE.Color(ANOMALY_COLORS.cross_floor);
    }
    if (building.anomalies.includes('needs_confirmation')) {
      return new THREE.Color(ANOMALY_COLORS.needs_confirmation);
    }
    if (marker?.isAnomaly) {
      return new THREE.Color(ANOMALY_COLORS.coordinate_offset);
    }
    if (building.sunlightHours === null) {
      return new THREE.Color(0x5a6a7a);
    }
    if (building.sunlightHours < SUNLIGHT_STANDARD) {
      return new THREE.Color(ANOMALY_COLORS.coordinate_offset);
    }
    if (building.boundaryCase) {
      return new THREE.Color(0xffd93d);
    }
    return new THREE.Color(0x4a90a0);
  }, [building, isFiltered, marker]);

  const material = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      metalness: 0.3,
      roughness: 0.5,
      transparent: true,
      opacity: isFiltered ? 0.9 : 0.2,
      transmission: 0.1,
      clearcoat: 0.2,
    });
  }, [baseColor, isFiltered]);

  const edgesGeometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(
      building.dimensions[0],
      building.dimensions[1],
      building.dimensions[2]
    );
    return new THREE.EdgesGeometry(geo);
  }, [building.dimensions]);

  const edgeColor = useMemo(() => {
    if (isSelected) return new THREE.Color(0xffb347);
    if (hovered) return new THREE.Color(0xffffff);
    return new THREE.Color(0x6a7a8a);
  }, [isSelected, hovered]);

  useFrame((state) => {
    if (meshRef.current && isSelected) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.02;
      meshRef.current.scale.setScalar(pulse);
    } else if (meshRef.current) {
      meshRef.current.scale.setScalar(1);
    }
  });

  const positionY = building.dimensions[1] / 2;

  return (
    <group position={[building.position[0], positionY, building.position[2]]}>
      <mesh
        ref={meshRef}
        material={material}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
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
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            building.dimensions[0],
            building.dimensions[1],
            building.dimensions[2],
          ]}
        />
      </mesh>
      <lineSegments ref={edgesRef} geometry={edgesGeometry}>
        <lineBasicMaterial color={edgeColor} linewidth={isSelected ? 2 : 1} />
      </lineSegments>
    </group>
  );
}
