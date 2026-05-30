import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { FilterPanel } from '@/components/FilterPanel';
import { RiskTerrainScene } from '@/components/terrain/RiskTerrainScene';
import { PeakDetailPanel } from '@/components/PeakDetailPanel';
import { RiskLegend } from '@/components/RiskLegend';
import { TimelineSlider } from '@/components/TimelineSlider';
import type { TerrainDataPoint } from '@/types';

export default function TerrainPage() {
  const [selectedPoint, setSelectedPoint] = useState<TerrainDataPoint | null>(null);

  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <FilterPanel />
        <div className="flex-1 relative">
          <RiskTerrainScene onPointSelect={setSelectedPoint} />
          <RiskLegend />
          {selectedPoint && (
            <PeakDetailPanel
              dataPoint={selectedPoint}
              onClose={() => setSelectedPoint(null)}
            />
          )}
          <TimelineSlider />
        </div>
      </div>
    </div>
  );
}
