import { useMemo } from 'react';
import { BuildingMesh } from './BuildingMesh';
import { useBuildings, useFilteredBuildings, useSandboxStore } from '../../store/useSandboxStore';

export function Buildings() {
  const allBuildings = useBuildings();
  const filteredBuildings = useFilteredBuildings();
  const selectedId = useSandboxStore(s => s.selectedBuildingId);
  const setSelected = useSandboxStore(s => s.setSelectedBuilding);

  const filteredIds = useMemo(() => {
    return new Set(filteredBuildings.map(b => b.id));
  }, [filteredBuildings]);

  return (
    <group>
      {allBuildings.map(building => (
        <BuildingMesh
          key={building.id}
          building={building}
          isSelected={selectedId === building.id}
          isFiltered={filteredIds.has(building.id)}
          onClick={() => setSelected(building.id)}
        />
      ))}
    </group>
  );
}
