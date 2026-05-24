import { useRef } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Box, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Cargo, BAY_SCALE } from '../../types';
import { getBayWorldPosition } from '../../utils/gravity';
import { useStore } from '../../store/useStore';

interface Cargo3DProps {
  cargo: Cargo;
  bayId: string;
}

const cargoColors: Record<string, string> = {
  heavy: '#4A90D9',
  reefer: '#2EC4B6',
  dangerous: '#D8315B',
};

export function Cargo3D({ cargo, bayId }: Cargo3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const selectedCargo = useStore((state) => state.selectedCargo);
  const selectedBay = useStore((state) => state.selectedBay);
  const setSelectedCargo = useStore((state) => state.setSelectedCargo);
  const setSelectedBay = useStore((state) => state.setSelectedBay);
  const unloadCargo = useStore((state) => state.unloadCargo);
  const bays = useStore((state) => state.bays);

  const bay = bays.find((b) => b.id === bayId);
  if (!bay) return null;

  const pos = getBayWorldPosition(bay);
  const isSelected = selectedCargo === cargo.id || selectedBay === bayId;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSelectedCargo(cargo.id);
    setSelectedBay(bayId);
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    unloadCargo(bayId);
  };

  return (
    <group position={[pos.x, pos.y + BAY_SCALE / 2, pos.z]}>
      <Box
        ref={meshRef}
        args={[BAY_SCALE * 1.8, BAY_SCALE * 0.9, BAY_SCALE * 0.9]}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <meshStandardMaterial
          color={cargoColors[cargo.type]}
          metalness={0.3}
          roughness={0.5}
          emissive={isSelected ? cargoColors[cargo.type] : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </Box>
      
      <Html
        position={[0, BAY_SCALE * 0.6, 0]}
        center
        distanceFactor={10}
        zIndexRange={[100, 0]}
      >
        <div className="bg-gray-900 bg-opacity-90 px-2 py-1 rounded text-xs text-white whitespace-nowrap font-mono">
          <div className="font-bold">{cargo.name}</div>
          <div className="text-gray-300">{cargo.weight}吨</div>
        </div>
      </Html>

      {isSelected && (
        <Box args={[BAY_SCALE * 1.9, BAY_SCALE * 0.95, BAY_SCALE * 0.95]}>
          <meshBasicMaterial color="#FFD700" wireframe transparent opacity={0.8} />
        </Box>
      )}
    </group>
  );
}
