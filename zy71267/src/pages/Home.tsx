import { useAcousticStore } from '../store/acousticStore';
import { TopToolbar } from '../components/ui/TopToolbar';
import { ControlPanel } from '../components/ui/ControlPanel';
import { InfoPanel } from '../components/ui/InfoPanel';
import { WelcomeScreen } from '../components/ui/WelcomeScreen';
import { StatusBar } from '../components/ui/StatusBar';
import { AnomalyPanel } from '../components/ui/AnomalyPanel';
import { SeatTooltip } from '../components/ui/SeatTooltip';
import { HallScene } from '../components/scene/HallScene';

export default function Home() {
  const {
    dataset,
    anomalies,
    isLoading,
    displayParam,
    rayFilter,
    selectedSeatId,
    hoveredSeatId,
    showHallWireframe,
    showRays,
    showSeats,
    showSources,
    cameraView,
    loadDataset,
    updateDisplayParam,
    updateRayFilter,
    selectSeat,
    hoverSeat,
    toggleHallWireframe,
    toggleRays,
    toggleSeats,
    toggleSources,
    setCameraView,
    getSelectedSeatData,
    getFilteredRays,
  } = useAcousticStore();

  const selectedSeat = getSelectedSeatData();
  const filteredRays = getFilteredRays();
  const hoveredSeatData = hoveredSeatId
    ? dataset?.seats.find((s) => s.id === hoveredSeatId) || null
    : null;
  const hoveredReading = hoveredSeatId
    ? dataset?.acousticReadings.find((r) => r.seatId === hoveredSeatId)
    : undefined;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden">
      <TopToolbar
        dataset={dataset}
        anomalies={anomalies}
        displayParam={displayParam}
        isLoading={isLoading}
        cameraView={cameraView}
        onLoadDataset={loadDataset}
        onSetCameraView={setCameraView}
      />

      <div className="flex-1 flex overflow-hidden">
        {dataset && (
          <ControlPanel
            displayParam={displayParam}
            rayFilter={rayFilter}
            showHallWireframe={showHallWireframe}
            showRays={showRays}
            showSeats={showSeats}
            showSources={showSources}
            onDisplayParamChange={updateDisplayParam}
            onRayFilterChange={updateRayFilter}
            onToggleHallWireframe={toggleHallWireframe}
            onToggleRays={toggleRays}
            onToggleSeats={toggleSeats}
            onToggleSources={toggleSources}
          />
        )}

        <div
          id="scene-container"
          className="flex-1 relative overflow-hidden"
        >
          {!dataset ? (
            <WelcomeScreen onLoadDemo={loadDataset} isLoading={isLoading} />
          ) : (
            <>
              <HallScene
                dataset={dataset}
                displayParam={displayParam}
                rayFilter={rayFilter}
                selectedSeatId={selectedSeatId}
                hoveredSeatId={hoveredSeatId}
                anomalies={anomalies}
                showHallWireframe={showHallWireframe}
                showRays={showRays}
                showSeats={showSeats}
                showSources={showSources}
                cameraView={cameraView}
                onSeatSelect={selectSeat}
                onSeatHover={hoverSeat}
                getFilteredRays={getFilteredRays}
              />

              {hoveredSeatData && (
                <SeatTooltip
                  hoveredSeat={hoveredSeatData}
                  reading={hoveredReading}
                  displayParam={displayParam}
                />
              )}
            </>
          )}
        </div>

        {dataset && selectedSeat && (
          <InfoPanel
            selectedSeat={selectedSeat}
            displayParam={displayParam}
            onClose={() => selectSeat(null)}
          />
        )}
      </div>

      <StatusBar
        dataset={dataset}
        anomalies={anomalies}
        filteredRayCount={filteredRays.length}
      />

      {dataset && <AnomalyPanel anomalies={anomalies} />}
    </div>
  );
}
