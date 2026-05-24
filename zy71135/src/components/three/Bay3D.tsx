import { useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Box } from '@react-three/drei';
import * as THREE from 'three';
import { Bay, BAY_SCALE } from '../../types';
import { getBayWorldPosition } from '../../utils/gravity';
import { useStore } from '../../store/useStore';
import { canLoadCargo } from '../../utils/rules';

interface Bay3DProps {
  bay: Bay;
}

export function Bay3D({ bay }: Bay3DProps) {
  const selectedCargo = useStore((state) => state.selectedCargo);
  const selectedBay = useStore((state) => state.selectedBay);
  const cargoList = useStore((state) => state.cargoList);
  const bays = useStore((state) => state.bays);
  const setSelectedBay = useStore((state) => state.setSelectedBay);
  const loadCargo = useStore((state) => state.loadCargo);

  const pos = getBayWorldPosition(bay);
  const isOccupied = !!bay.occupiedBy;
  const isSelected = selectedBay === bay.id;

  const previewAlerts = useMemo(() => {
    if (!selectedCargo || isOccupied) return [];
    const cargo = cargoList.find((c) => c.id === selectedCargo);
    if (!cargo) return [];
    return canLoadCargo(cargo, bay, bays, cargoList);
  }, [selectedCargo, bay, bays, cargoList, isOccupied]);

  const hasWarning = previewAlerts.length > 0;
  const canDrop = selectedCargo && !isOccupied;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    
    if (selectedCargo && !isOccupied) {
      loadCargo(selectedCargo, bay.id);
    } else {
      setSelectedBay(bay.id);
    }
  };

  let color = '#1a365d';
  if (bay.hasPower) {
    color = '#1e3a5f';
  }
  if (canDrop && !hasWarning) {
    color = '#2d5a3d';
  } else if (canDrop && hasWarning) {
    color = '#5a4a2d';
  }

  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <Box
        args={[BAY_SCALE * 1.9, BAY_SCALE * 0.05, BAY_SCALE * 0.95]}
        position={[0, 0, 0]}
        onClick={handleClick}
      >
        <meshStandardMaterial
          color={color}
          metalness={0.5}
          roughness={0.5}
        />
      </Box>

      <Box
        args={[BAY_SCALE * 1.9, BAY_SCALE * 0.9, BAY_SCALE * 0.95]}
        position={[0, BAY_SCALE * 0.45, 0]}
        onClick={handleClick}
      >
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </Box>

      {bay.hasPower && (
        <Box
          args={[BAY_SCALE * 0.3, BAY_SCALE * 0.1, BAY_SCALE * 0.1]}
          position={[BAY_SCALE * 0.8, BAY_SCALE * 0.05, 0]}
        >
          <meshBasicMaterial color="#2EC4B6" />
        </Box>
      )}

      {isSelected && !isOccupied && (
        <Box
          args={[BAY_SCALE * 1.95, BAY_SCALE * 0.95, BAY_SCALE * 0.98]}
          position={[0, BAY_SCALE * 0.45, 0]}
        >
          <meshBasicMaterial color="#FFD700" wireframe transparent opacity={0.6} />
        </Box>
      )}

      {canDrop && !hasWarning && (
        <Box
          args={[BAY_SCALE * 1.9, BAY_SCALE * 0.9, BAY_SCALE * 0.95]}
          position={[0, BAY_SCALE * 0.45, 0]}
        >
          <meshBasicMaterial color="#2EC4B6" wireframe transparent opacity={0.4} />
        </Box>
      )}

      {canDrop && hasWarning && (
        <Box
          args={[BAY_SCALE * 1.9, BAY_SCALE * 0.9, BAY_SCALE * 0.95]}
          position={[0, BAY_SCALE * 0.45, 0]}
        >
          <meshBasicMaterial color="#FF9F1C" wireframe transparent opacity={0.5} />
        </Box>
      )}
    </group>
  );
}
