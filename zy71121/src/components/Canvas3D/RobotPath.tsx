import { useMemo } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';

export function RobotPath() {
  const { robotPath, plants, validation } = useSimulationStore();
  
  const pathGeometry = useMemo(() => {
    if (!robotPath.enabled) return null;
    
    const rowSpacingM = plants.rowSpacing / 100;
    const pathWidthM = robotPath.width / 100;
    const lengthM = plants.plantsPerRow * plants.plantSpacing / 100 + 2;
    
    const posX = (robotPath.position - 0.5 - (plants.rowsCount - 1) / 2) * rowSpacingM * 2;
    
    return {
      position: [posX, 0.02, 0] as [number, number, number],
      width: pathWidthM,
      length: lengthM,
    };
  }, [robotPath, plants]);
  
  if (!robotPath.enabled || !pathGeometry) return null;
  
  const pathColor = validation.pathWidthOk ? '#3b82f6' : '#ef4444';
  
  return (
    <group>
      <mesh
        position={pathGeometry.position}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[pathGeometry.width, pathGeometry.length]} />
        <meshStandardMaterial
          color={pathColor}
          transparent
          opacity={0.4}
        />
      </mesh>
      
      <mesh position={[pathGeometry.position[0] - pathGeometry.width / 2 - 0.05, 0.1, 0]}>
        <boxGeometry args={[0.02, 0.2, pathGeometry.length]} />
        <meshStandardMaterial color={pathColor} />
      </mesh>
      <mesh position={[pathGeometry.position[0] + pathGeometry.width / 2 + 0.05, 0.1, 0]}>
        <boxGeometry args={[0.02, 0.2, pathGeometry.length]} />
        <meshStandardMaterial color={pathColor} />
      </mesh>
      
      {!validation.pathWidthOk && (
        <mesh position={[pathGeometry.position[0], 0.03, 0]}>
          <ringGeometry args={[0.3, 0.5, 6]} />
          <meshBasicMaterial color="#ef4444" side={2} />
        </mesh>
      )}
    </group>
  );
}
