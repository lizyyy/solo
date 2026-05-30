import { useEffect, useCallback, useState } from 'react';
import { Info, Thermometer } from 'lucide-react';
import { Scene } from '@/three/Scene';
import { BandSwitcher } from '@/components/BandSwitcher';
import { FrequencyChart } from '@/components/FrequencyChart';
import { RiskPanel } from '@/components/RiskPanel';
import { useInstrumentStore } from '@/store/useInstrumentStore';
import { useRiskStore } from '@/store/useRiskStore';

export function FrequencyView() {
  const [showHeatmap, setShowHeatmap] = useState(true);

  const {
    instrumentData,
    sectionParams,
    currentBand,
    selectedHotspotId,
    cameraTarget,
    setCurrentBand,
    setSelectedHotspot,
    setCameraTarget,
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
          <h2 className="font-serif text-2xl text-bronze-400">{instrument.name} · 频段分析</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            频率采样数据来源：{[...new Set(samples.map((s) => s.dataSource))].join('、')}，
            测量日期：{[...new Set(samples.map((s) => s.measurementDate))].join('、')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`p-1.5 rounded transition-colors ${
                showHeatmap ? 'text-bronze-500' : 'text-gray-500'
              }`}
            >
              <Thermometer size={18} />
            </button>
            <span className="text-sm text-gray-400">热力图叠加</span>
          </label>
          <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
            <Info size={14} />
            <span>{samples.length} 个采样点</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">
          <div className="h-1/2 min-h-0">
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
                showHeatmap={showHeatmap}
              />
            </div>
          </div>

          <div className="h-1/2 min-h-0">
            <FrequencyChart samples={samples} currentBand={currentBand} />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
          <BandSwitcher current={currentBand} onChange={setCurrentBand} />

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
            <h3 className="font-serif text-lg text-bronze-400 mb-3">采样点分布</h3>
            <div className="grid grid-cols-3 gap-2">
              {['low', 'mid', 'high'].map((band) => {
                const bandSamples = samples.filter((s) => s.band === band);
                const bandConfig = [
                  { key: 'low', label: '低频', color: '#1E88E5' },
                  { key: 'mid', label: '中频', color: '#43A047' },
                  { key: 'high', label: '高频', color: '#E53935' },
                ].find((b) => b.key === band)!;

                return (
                  <div
                    key={band}
                    className={`p-3 rounded-lg text-center border transition-all ${
                      currentBand === band
                        ? 'bg-charcoal-800 border-charcoal-600'
                        : 'bg-charcoal-900/50 border-transparent'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full mx-auto mb-2"
                      style={{ backgroundColor: bandConfig.color }}
                    />
                    <p className="text-sm font-serif" style={{ color: bandConfig.color }}>
                      {bandConfig.label}
                    </p>
                    <p className="text-lg font-serif font-semibold text-gray-300">
                      {bandSamples.length}
                    </p>
                    <p className="text-xs text-gray-600 font-mono">个采样点</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card-panel">
            <h3 className="font-serif text-lg text-bronze-400 mb-3">频段说明</h3>
            <div className="space-y-3">
              <div className="p-3 bg-acoustic-low/10 rounded-lg border border-acoustic-low/30">
                <h4 className="text-sm font-mono text-acoustic-low mb-1">低频 (80-250Hz)</h4>
                <p className="text-xs text-gray-400">
                  决定乐器的音色厚度和共鸣感，主要由大型共鸣腔体产生。古琴的龙池、琵琶的主共鸣箱、提琴的f孔是主要辐射源。
                </p>
              </div>
              <div className="p-3 bg-acoustic-mid/10 rounded-lg border border-acoustic-mid/30">
                <h4 className="text-sm font-mono text-acoustic-mid mb-1">中频 (250-2000Hz)</h4>
                <p className="text-xs text-gray-400">
                  乐器的核心频段，决定音色的明亮度和表现力。音梁、音柱等内部结构对中频响应有关键影响。
                </p>
              </div>
              <div className="p-3 bg-acoustic-high/10 rounded-lg border border-acoustic-high/30">
                <h4 className="text-sm font-mono text-acoustic-high mb-1">高频 (2000-8000Hz)</h4>
                <p className="text-xs text-gray-400">
                  决定音色的穿透力和泛音丰富度。面板弧度、漆层厚度、音孔边缘处理是高频特性的关键因素。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
