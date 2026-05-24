import { useState } from 'react';
import {
  PanelRightClose,
  Eye,
  AlertTriangle,
  MapPin,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit3,
} from 'lucide-react';
import { useSceneStore } from '@/store/sceneStore';
import { useAnalysisStore } from '@/store/analysisStore';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { BlindSpot, Severity, BlindSpotType } from '@/types';

const severityConfig: Record<Severity, { label: string; color: string; bgColor: string }> = {
  low: { label: '低', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  medium: { label: '中', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  high: { label: '高', color: 'text-red-400', bgColor: 'bg-red-500/20' },
};

const typeConfig: Record<BlindSpotType, { label: string; icon: string }> = {
  occlusion: { label: '遮挡盲区', icon: '🚧' },
  missing_sign: { label: '缺少导视', icon: '❓' },
  temporary_barrier: { label: '临时围挡', icon: '⚠️' },
};

export function RightPanel() {
  const [expandedSections, setExpandedSections] = useState({
    blindSpots: true,
    visibility: true,
    elements: false,
  });

  const rightPanelOpen = useUIStore(state => state.rightPanelOpen);
  const setRightPanelOpen = useUIStore(state => state.setRightPanelOpen);
  
  const blindSpots = useAnalysisStore(state => state.blindSpots);
  const activeBlindSpot = useAnalysisStore(state => state.activeBlindSpot);
  const setActiveBlindSpot = useAnalysisStore(state => state.setActiveBlindSpot);
  const removeBlindSpot = useAnalysisStore(state => state.removeBlindSpot);
  const visibilityCheckEnabled = useAnalysisStore(state => state.visibilityCheckEnabled);
  const setVisibilityCheckEnabled = useAnalysisStore(state => state.setVisibilityCheckEnabled);
  const visibilityResults = useAnalysisStore(state => state.visibilityResults);
  
  const elements = useSceneStore(state => state.elements);
  const selectedElement = useSceneStore(state => state.selectedElement);
  const setSelectedElement = useSceneStore(state => state.setSelectedElement);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const signages = elements.filter(el => el.type === 'signage');

  return (
    <div
      className={cn(
        'absolute right-4 top-20 bottom-24 z-20 w-72',
        'transition-all duration-300 ease-in-out',
        rightPanelOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      <div className="h-full bg-slate-900/90 backdrop-blur-md rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden flex flex-col">
        <div className="p-3 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white text-sm">分析面板</h3>
            <button
              onClick={() => setRightPanelOpen(false)}
              className="p-1 rounded hover:bg-slate-700/50 transition-colors"
            >
              <PanelRightClose className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="bg-slate-800/50 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('blindSpots')}
              className="w-full flex items-center justify-between p-3 hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-white">导视盲区</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/20 text-orange-400">
                {blindSpots.length}
              </span>
            </div>
            {expandedSections.blindSpots ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {expandedSections.blindSpots && (
            <div className="px-3 pb-3 space-y-2">
              {blindSpots.map(spot => (
                <div
                  key={spot.id}
                  onClick={() => setActiveBlindSpot(spot.id)}
                  className={cn(
                    'p-3 rounded-lg cursor-pointer transition-all',
                    activeBlindSpot === spot.id
                      ? 'bg-orange-600/30 border border-orange-500/50'
                      : 'bg-slate-700/30 hover:bg-slate-700/50'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{typeConfig[spot.type].icon}</span>
                      <span className="text-sm text-white font-medium">
                        {typeConfig[spot.type].label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={cn(
                        'px-2 py-0.5 text-xs rounded-full',
                        severityConfig[spot.severity].bgColor,
                        severityConfig[spot.severity].color
                      )}>
                        {severityConfig[spot.severity].label}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{spot.description}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="p-1 rounded hover:bg-slate-600/50 transition-colors"
                    >
                      <Edit3 className="w-3 h-3 text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBlindSpot(spot.id);
                      }}
                      className="p-1 rounded hover:bg-red-600/30 transition-colors"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('visibility')}
            className="w-full flex items-center justify-between p-3 hover:bg-slate-700/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-white">视线检测</span>
            </div>
            {expandedSections.visibility ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {expandedSections.visibility && (
            <div className="px-3 pb-3 space-y-2">
              <button
                onClick={() => setVisibilityCheckEnabled(!visibilityCheckEnabled)}
                className={cn(
                  'w-full flex items-center justify-between p-2 rounded-lg transition-all',
                  visibilityCheckEnabled
                    ? 'bg-cyan-600/30 border border-cyan-500/50 text-cyan-400'
                    : 'bg-slate-700/30 text-slate-400 hover:bg-slate-700/50'
                )}
              >
                <span className="text-xs font-medium">
                  {visibilityCheckEnabled ? '关闭检测' : '开启检测'}
                </span>
                {visibilityCheckEnabled ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
              
              {visibilityCheckEnabled && visibilityResults.length > 0 && (
                <div className="space-y-1">
                  {visibilityResults.map((result, index) => {
                    const signage = signages.find(s => s.id === result.signageId);
                    return (
                      <div
                        key={result.signageId}
                        className="flex items-center justify-between p-2 rounded bg-slate-700/30"
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'w-2 h-2 rounded-full',
                            result.isVisible ? 'bg-green-500' : 'bg-red-500'
                          )} />
                          <span className="text-xs text-slate-300">
                            {signage?.name || `导视牌 ${index + 1}`}
                          </span>
                        </div>
                        <span className={cn(
                          'text-xs',
                          result.isVisible ? 'text-green-400' : 'text-red-400'
                        )}>
                          {result.isVisible ? '可见' : '不可见'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('elements')}
            className="w-full flex items-center justify-between p-3 hover:bg-slate-700/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-white">选中元素</span>
            </div>
            {expandedSections.elements ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {expandedSections.elements && (
            <div className="px-3 pb-3">
              {selectedElement ? (
                <div className="p-3 rounded-lg bg-slate-700/30">
                  {(() => {
                    const el = elements.find(e => e.id === selectedElement);
                    return el ? (
                      <>
                        <div className="text-sm text-white font-medium mb-1">
                          {el.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          类型: {el.type}
                        </div>
                        <div className="text-xs text-slate-400">
                          位置: ({el.position[0].toFixed(1)}, {el.position[2].toFixed(1)})
                        </div>
                      </>
                    ) : null;
                  })()}
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center py-2">
                  点击场景中的元素进行选择
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {!rightPanelOpen && (
      <button
        onClick={() => setRightPanelOpen(true)}
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-slate-800 p-2 rounded-l-lg border-r-0 border border-slate-700 hover:bg-slate-700 transition-colors z-20"
      >
        <PanelRightClose className="w-4 h-4 text-slate-400 rotate-180" />
      </button>
    )}
    </div>
  );
}
