import React from 'react';
import { Map2D } from '@/components/map/Map2D';
import { Map3D } from '@/components/map/Map3D';
import { StatsPanel } from '@/components/shelter/StatsPanel';
import { TimelinePanel } from '@/components/shelter/TimelinePanel';
import { ShelterDetailPanel } from '@/components/shelter/ShelterDetailPanel';
import { useShelter } from '@/hooks/useShelter';

export const MapPage: React.FC = () => {
  const { is3DMode, filteredShelters, selectedShelter, setSelectedShelter } = useShelter();

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-gray-900">
      {is3DMode ? (
        <Map3D
          shelters={filteredShelters}
          selectedShelter={selectedShelter}
          onSelectShelter={setSelectedShelter}
        />
      ) : (
        <Map2D
          shelters={filteredShelters}
          selectedShelter={selectedShelter}
          onSelectShelter={setSelectedShelter}
        />
      )}

      <StatsPanel />
      <TimelinePanel />
      <ShelterDetailPanel />
    </div>
  );
};
