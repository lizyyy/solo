import { useEffect, useCallback, useState } from 'react';
import { Info, MapPin, Layers } from 'lucide-react';
import { Scene } from '@/three/Scene';
import { HotspotList } from '@/components/HotspotList';
import { RiskPanel } from '@/components/RiskPanel';
import { useInstrumentStore } from '@/store/useInstrumentStore';
import { useRiskStore } from '@/store/useRiskStore';
import { BusinessRules } from '@/utils/businessRules';

export function HotspotView() {
  const [showAllHotspots, setShowAllHotspots] = useState(true);
  const [filterCategory, setFilterCategory] = useState<'all' | 'structure' | 'acoustics' | 'craftsmanship'>('all');

  const {
    instrumentData,
    sectionParams,
    currentBand,
    selectedHotspotId,
    cameraTarget,
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
    (id: string | null) => {
      setSelectedHotspot(id);
      if (id) {
        const hotspot = instrumentData?.hotspots.find((h) => h.id === id);
        if (hotspot) {
          setCameraTarget(hotspot.position);
        }
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

  const filteredHotspots = filterCategory === 'all'
    ? hotspots
    : hotspots.filter((h) => h.category === filterCategory);

  const categoryStats = {
    structure: hotspots.filter((h) => h.category === 'structure').length,
    acoustics: hotspots.filter((h) => h.category === 'acoustics').length,
    craftsmanship: hotspots.filter((h) => h.category === 'craftsmanship').length,
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-2xl text-bronze-400">{instrument.name} · 热点标注</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            点击列表或3D视图中的热点标记，快速定位到乐器关键结构。共 {hotspots.length} 个讲解点。
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <button
              onClick={() => setShowAllHotspots(!showAllHotspots)}
              className={`p-1.5 rounded transition-colors ${
                showAllHotspots ? 'text-bronze-500' : 'text-gray-500'
              }`}
            >
              <Layers size={18} />
            </button>
            <span className="text-sm text-gray-400">显示全部热点</span>
          </label>
          <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
            <Info size={14} />
            <span>{hotspots.length} 个讲解点</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">
          <div className="flex-1 min-h-0">
            <div className="canvas-container h-full">
              <Scene
                instrument={instrument}
                cavities={cavities}
                hotspots={showAllHotspots ? filteredHotspots : (selectedHotspotId ? hotspots.filter((h) => h.id === selectedHotspotId) : [])}
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
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-acoustic-low" />
                <MapPin size={14} className="text-acoustic-low" />
              </div>
              <p className="text-xs text-gray-500 font-mono">结构类</p>
              <p className="text-xl font-serif text-acoustic-low">{categoryStats.structure}</p>
            </div>
            <div className="card-panel text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-acoustic-mid" />
                <MapPin size={14} className="text-acoustic-mid" />
              </div>
              <p className="text-xs text-gray-500 font-mono">声学类</p>
              <p className="text-xl font-serif text-acoustic-mid">{categoryStats.acoustics}</p>
            </div>
            <div className="card-panel text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-acoustic-high" />
                <MapPin size={14} className="text-acoustic-high" />
              </div>
              <p className="text-xs text-gray-500 font-mono">工艺类</p>
              <p className="text-xl font-serif text-acoustic-high">{categoryStats.craftsmanship}</p>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
          <div className="card-panel">
            <h3 className="font-serif text-lg text-bronze-400 mb-3">分类筛选</h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'all', label: '全部', color: 'text-bronze-400 border-bronze-600' },
                { key: 'structure', label: '结构', color: 'text-acoustic-low border-acoustic-low' },
                { key: 'acoustics', label: '声学', color: 'text-acoustic-mid border-acoustic-mid' },
                { key: 'craftsmanship', label: '工艺', color: 'text-acoustic-high border-acoustic-high' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilterCategory(item.key as typeof filterCategory)}
                  className={`
                    py-2 px-3 rounded-lg text-sm font-mono transition-all
                    ${filterCategory === item.key
                      ? `bg-charcoal-800 border ${item.color}`
                      : 'bg-charcoal-900/50 border border-transparent text-gray-500 hover:text-gray-300'
                    }
                  `}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <HotspotList
            hotspots={filteredHotspots}
            selectedId={selectedHotspotId}
            onSelect={handleHotspotClick}
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
            <div className="p-3 bg-walnut-900/30 rounded-lg border border-bronze-700/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-mono text-bronze-400">热点标注</span>
                <span className="text-xs text-gray-500 font-mono">
                  阈值：{BusinessRules.getHotspotTolerance() * 1000}mm
                </span>
              </div>
              <p className="text-xs text-bronze-300 font-mono leading-relaxed">
                {BusinessRules.getExplanation('hotspot_annotation').explanation}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {BusinessRules.getExplanation('hotspot_annotation').ruleBasis}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
