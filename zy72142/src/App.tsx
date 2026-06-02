import { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { AnomalyPanel } from './components/AnomalyPanel';
import { TrackTable } from './components/TrackTable';
import { ExportBar } from './components/ExportBar';
import { usePlaylist } from './hooks/usePlaylist';
import type { FilterOptions, AnomalyType } from './types';

function App() {
  const { playlist, filterTracks, updateTrackRemark, updateTrackAnomaly, resetToMock, anomalyStats } = usePlaylist();
  
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    status: 'all',
    anomalyType: 'all',
  });

  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyType | 'all' | null>(null);
  const [highlightedTrackId, setHighlightedTrackId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedAnomaly) {
      if (selectedAnomaly === 'all') {
        setFilters((prev) => ({ ...prev, status: 'anomaly', anomalyType: 'all' }));
      } else {
        setFilters((prev) => ({ ...prev, status: 'all', anomalyType: selectedAnomaly }));
      }
    } else {
      setFilters((prev) => ({ ...prev, status: 'all', anomalyType: 'all' }));
    }
  }, [selectedAnomaly]);

  const filteredTracks = useMemo(() => {
    return filterTracks(playlist.tracks, filters);
  }, [playlist.tracks, filters, filterTracks]);

  const handleAnomalySelect = (type: AnomalyType | 'all' | null) => {
    setSelectedAnomaly(type);
    if (type && filteredTracks.length > 0) {
      setHighlightedTrackId(filteredTracks[0].id);
      setTimeout(() => setHighlightedTrackId(null), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F1DE]">
      <Header playlist={playlist} onReset={resetToMock} />
      
      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        totalCount={playlist.tracks.length}
        filteredCount={filteredTracks.length}
      />

      <main className="max-w-7xl mx-auto px-6 py-6 pb-24">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-72 flex-shrink-0">
            <AnomalyPanel
              stats={anomalyStats}
              selectedAnomaly={selectedAnomaly}
              onSelect={handleAnomalySelect}
            />
          </aside>

          <div className="flex-1 min-w-0">
            <TrackTable
              tracks={filteredTracks}
              onUpdateRemark={updateTrackRemark}
              onUpdateAnomaly={updateTrackAnomaly}
              highlightedTrackId={highlightedTrackId}
            />
          </div>
        </div>
      </main>

      <ExportBar
        playlist={playlist}
        filteredTracks={filteredTracks}
        totalTracks={playlist.tracks.length}
      />
    </div>
  );
}

export default App;
