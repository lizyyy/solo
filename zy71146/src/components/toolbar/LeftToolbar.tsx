import {
  Layers,
  Eye,
  EyeOff,
  Columns,
  MapPin,
  Building2,
  Route,
  ShieldAlert,
  RotateCcw,
  Camera,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { useSceneStore } from '@/store/sceneStore';
import { useAnalysisStore } from '@/store/analysisStore';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';

export function LeftToolbar() {
  const resetScene = useSceneStore(state => state.resetScene);
  const setCameraPreset = useSceneStore(state => state.setCameraPreset);
  const filters = useAnalysisStore(state => state.filters);
  const toggleFilter = useAnalysisStore(state => state.toggleFilter);
  const leftPanelOpen = useUIStore(state => state.leftPanelOpen);
  const setLeftPanelOpen = useUIStore(state => state.setLeftPanelOpen);

  const filterItems = [
    { key: 'columns', icon: Columns, label: '柱子' },
    { key: 'signages', icon: MapPin, label: '导视牌' },
    { key: 'stores', icon: Building2, label: '店铺' },
    { key: 'barriers', icon: ShieldAlert, label: '围挡' },
    { key: 'paths', icon: Route, label: '路径' },
  ];

  return (
    <div
      className={cn(
        'absolute left-4 top-1/2 -translate-y-1/2 z-20',
        'transition-all duration-300 ease-in-out',
        leftPanelOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="bg-slate-900/90 backdrop-blur-md rounded-xl p-3 shadow-2xl border border-slate-700/50">
        <div className="flex flex-col gap-2">
          <div className="text-xs text-slate-400 font-semibold mb-1 px-2">图层筛选</div>
          
          {filterItems.map(item => (
            <button
              key={item.key}
              onClick={() => toggleFilter(item.key as keyof typeof filters)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200',
                'hover:bg-slate-700/50 group',
                filters[item.key as keyof typeof filters]
                  ? 'bg-cyan-600/30 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              )}
              title={item.label}
            >
              {filters[item.key as keyof typeof filters] ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4 opacity-50" />
              )}
              <item.icon className="w-4 h-4" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}

          <div className="h-px bg-slate-700/50 my-2" />

          <div className="text-xs text-slate-400 font-semibold mb-1 px-2">视角</div>
          
          <button
            onClick={() => setCameraPreset('top')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all"
            title="俯视"
          >
            <Maximize2 className="w-4 h-4" />
            <span className="text-xs font-medium">俯视</span>
          </button>
          
          <button
            onClick={() => setCameraPreset('front')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all"
            title="正视"
          >
            <Camera className="w-4 h-4" />
            <span className="text-xs font-medium">正视</span>
          </button>

          <div className="h-px bg-slate-700/50 my-2" />

          <button
            onClick={resetScene}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-orange-400 hover:text-orange-300 hover:bg-orange-600/20 transition-all"
            title="重置场景"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-xs font-medium">重置</span>
          </button>
        </div>
      </div>

      <button
        onClick={() => setLeftPanelOpen(!leftPanelOpen)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 bg-slate-800 p-1.5 rounded-r-lg border-l-0 border border-slate-700 hover:bg-slate-700 transition-colors"
      >
        <Layers className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}
