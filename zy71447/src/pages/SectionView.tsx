import { useEffect, useCallback } from 'react';
import { Info } from 'lucide-react';
import { Scene } from '@/three/Scene';
import { SectionControl } from '@/components/SectionControl';
import { RiskPanel } from '@/components/RiskPanel';
import { useInstrumentStore } from '@/store/useInstrumentStore';
import { useRiskStore } from '@/store/useRiskStore';
import { BusinessRules } from '@/utils/businessRules';

export function SectionView() {
  const {
    instrumentData,
    sectionParams,
    currentBand,
    selectedHotspotId,
    cameraTarget,
    setSectionParams,
    setSelectedHotspot,
    setCameraTarget,
    toggleMaterialVisibility,
    resetView,
  } = useInstrumentStore();

  const {
    risks,
    autoDetect,
    showRawData,
    detectRisks,
    clearRisks,
    toggleAutoDetect,
    toggleShowRawData,
  } = useRiskStore();

  const runDetection = useCallback(() => {
    if (instrumentData) {
      detectRisks(
        instrumentData.instrument,
        instrumentData.samples,
        instrumentData.hotspots,
        sectionParams,
        currentBand
      );
    }
  }, [instrumentData, sectionParams, currentBand, detectRisks]);

  useEffect(() => {
    if (autoDetect && instrumentData) {
      runDetection();
    }
  }, [autoDetect, instrumentData, sectionParams, currentBand, runDetection]);

  const handleHotspotClick = useCallback(
    (id: string) => {
      setSelectedHotspot(id);
      const hotspot = instrumentData?.hotspots.find((h) => h.id === id);
      if (hotspot) {
        setCameraTarget(hotspot.position);
      }
    },
    [instrumentData, setSelectedHotspot, setCameraTarget]
  );

  if (!instrumentData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="loading-ring" />
      </div>
    );
  }

  const { instrument, cavities, samples, hotspots } = instrumentData;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-2xl text-bronze-400">{instrument.name} · 3D剖面</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">{instrument.description}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
          <Info size={14} />
          <span>数据版本：v{instrument.dataVersion}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">
          <div className="flex-1 min-h-0">
            <div className="canvas-container h-full">
              <Scene
                instrument={instrument}
                cavities={cavities}
                hotspots={hotspots}
                samples={samples}
                sectionParams={sectionParams}
                currentBand={currentBand}
                selectedHotspotId={selectedHotspotId}
                cameraTarget={cameraTarget}
                onHotspotClick={handleHotspotClick}
                showHeatmap={false}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="card-panel text-center">
              <p className="text-xs text-gray-500 font-mono">总宽度</p>
              <p className="text-xl font-serif text-bronze-300">
                {instrument.dimensions.width.toFixed(3)} m
              </p>
            </div>
            <div className="card-panel text-center">
              <p className="text-xs text-gray-500 font-mono">总高度</p>
              <p className="text-xl font-serif text-bronze-300">
                {instrument.dimensions.height.toFixed(3)} m
              </p>
            </div>
            <div className="card-panel text-center">
              <p className="text-xs text-gray-500 font-mono">总深度</p>
              <p className="text-xl font-serif text-bronze-300">
                {instrument.dimensions.depth.toFixed(3)} m
              </p>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
          <SectionControl
            params={sectionParams}
            materialGroups={instrument.materialGroups}
            onChange={setSectionParams}
            onToggleMaterial={toggleMaterialVisibility}
            onReset={resetView}
            dimensions={instrument.dimensions}
          />

          <RiskPanel
            risks={risks}
            autoDetect={autoDetect}
            showRawData={showRawData}
            onDetect={runDetection}
            onToggleAutoDetect={toggleAutoDetect}
            onToggleShowRawData={toggleShowRawData}
            onClear={clearRisks}
          />

          <div className="card-panel">
            <h3 className="font-serif text-lg text-bronze-400 mb-3">业务规则摘要</h3>
            <div className="space-y-2">
              {BusinessRules.getRuleSummary().slice(0, 3).map((rule, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-charcoal-800/50 rounded-lg border border-charcoal-700/50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-mono text-bronze-400">{rule.category}</span>
                    {rule.threshold && (
                      <span className="text-xs text-gray-500 font-mono">
                        阈值：{rule.threshold}{rule.thresholdUnit}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-mono leading-relaxed">
                    {rule.rule}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
