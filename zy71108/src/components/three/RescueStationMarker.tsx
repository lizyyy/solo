import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RescueStation } from '../../types';

interface RescueStationMarkerProps {
  station: RescueStation;
  isSelected: boolean;
  onClick: () => void;
  terrainHeightmap?: number[][];
  terrainScale?: number;
}

export function RescueStationMarker({
  station,
  isSelected,
  onClick,
  terrainHeightmap,
  terrainScale = 1
}: RescueStationMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const position = useMemo(() => {
    let height = 0;
    if (terrainHeightmap && terrainHeightmap.length > 0) {
      const xIdx = Math.floor(station.position.x / 2);
      const zIdx = Math.floor(station.position.z / 2);
      if (terrainHeightmap[zIdx] && terrainHeightmap[zIdx][xIdx] !== undefined) {
        height = terrainHeightmap[zIdx][xIdx] * terrainScale * 0.5;
      }
    }
    return new THREE.Vector3(station.position.x, height + 3, station.position.z);
  }, [station.position, terrainHeightmap, terrainScale]);

  const scale = isSelected || hovered ? 1.2 : 1;

  useFrame((state) => {
    if (groupRef.current) {
      const time = state.clock.elapsedTime;
      groupRef.current.rotation.y = time * 0.5;
      groupRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
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
    >
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[4, 4, 4]} />
        <meshStandardMaterial color="#165DFF" />
      </mesh>
      
      <mesh position={[0, 5, 0]}>
        <coneGeometry args={[3, 2, 4]} />
        <meshStandardMaterial color="#FF4D4F" />
      </mesh>

      <mesh position={[0, 2.5, 2.01]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial color="white" side={THREE.DoubleSide} />
      </mesh>

      {isSelected && (
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4, 5, 32]} />
          <meshBasicMaterial color="#165DFF" side={THREE.DoubleSide} transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

export default RescueStationMarker;
