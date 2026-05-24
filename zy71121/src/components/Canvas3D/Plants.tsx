import { useMemo, useRef } from 'react';
import { InstancedMesh, Object3D, Color } from 'three';
import { useSimulationStore } from '../../store/useSimulationStore';

export function Plants() {
  const { plants } = useSimulationStore();
  const stemMeshRef = useRef<InstancedMesh>(null);
  const canopyMeshRef = useRef<InstancedMesh>(null);
  
  const plantPositions = useMemo(() => {
    const positions: { x: number; z: number }[] = [];
    const rowSpacingM = plants.rowSpacing / 100;
    const plantSpacingM = plants.plantSpacing / 100;
    
    for (let r = 0; r < plants.rowsCount; r++) {
      for (let p = 0; p < plants.plantsPerRow; p++) {
        const x = (r - (plants.rowsCount - 1) / 2) * rowSpacingM;
        const z = (p - (plants.plantsPerRow - 1) / 2) * plantSpacingM;
        positions.push({ x, z });
      }
    }
    return positions;
  }, [plants]);
  
  useMemo(() => {
    if (!stemMeshRef.current || !canopyMeshRef.current) return;
    
    const dummy = new Object3D();
    const plantHeightM = plants.plantHeight / 100;
    const canopyRadiusM = plants.canopyDiameter / 200;
    
    const stemColor = new Color('#2d5016');
    const canopyColor = new Color('#3d8b2e');
    
    plantPositions.forEach((pos, i) => {
      dummy.position.set(pos.x, plantHeightM / 2, pos.z);
      dummy.scale.set(1, plantHeightM, 1);
      dummy.updateMatrix();
      stemMeshRef.current!.setMatrixAt(i, dummy.matrix);
      stemMeshRef.current!.setColorAt(i, stemColor);
      
      dummy.position.set(pos.x, plantHeightM - canopyRadiusM * 0.3, pos.z);
      dummy.scale.set(canopyRadiusM * 2, canopyRadiusM * 1.5, canopyRadiusM * 2);
      dummy.updateMatrix();
      canopyMeshRef.current!.setMatrixAt(i, dummy.matrix);
      canopyMeshRef.current!.setColorAt(i, canopyColor);
    });
    
    stemMeshRef.current.instanceMatrix.needsUpdate = true;
    canopyMeshRef.current.instanceMatrix.needsUpdate = true;
    if (stemMeshRef.current.instanceColor) {
      stemMeshRef.current.instanceColor.needsUpdate = true;
    }
    if (canopyMeshRef.current.instanceColor) {
      canopyMeshRef.current.instanceColor.needsUpdate = true;
    }
  }, [plantPositions, plants]);
  
  const totalPlants = plants.rowsCount * plants.plantsPerRow;
  
  return (
    <group>
      <instancedMesh
        ref={stemMeshRef}
        args={[undefined, undefined, totalPlants]}
        castShadow
      >
        <cylinderGeometry args={[0.03, 0.04, 1, 8]} />
        <meshStandardMaterial />
      </instancedMesh>
      
      <instancedMesh
        ref={canopyMeshRef}
        args={[undefined, undefined, totalPlants]}
        castShadow
      >
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  );
}
