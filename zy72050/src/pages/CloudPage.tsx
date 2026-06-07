import { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, FileText, Layers, Database, Flag, Camera } from 'lucide-react';
import Scene3D from '@/components/Scene3D';
import TracePanel from '@/components/TracePanel';
import FilterBar from '@/components/FilterBar';
import { useAppStore, useFilteredData } from '@/store/appStore';
import type { GreekAxis, CameraState } from '@/types';
import { formatDateTime } from '@/utils/data';

const axisOptions: { label: string; value: GreekAxis }[] = [
  { label: 'Delta', value: 'delta' },
  { label: 'Gamma', value: 'gamma' },
  { label: 'Theta', value: 'theta' },
  { label: 'Vega', value: 'vega' },
];

export default function CloudPage() {
  const navigate = useNavigate();
  const data = useAppStore(s => s.data);
  const selectedId = useAppStore(s => s.selectedId);
  const filters = useAppStore(s => s.filters);
  const storeCamera = useAppStore(s => s.camera);
  const setSelected = useAppStore(s => s.setSelected);
  const setFilters = useAppStore(s => s.setFilters);
  const setCamera = useAppStore(s => s.setCamera);
  const saveScheme = useAppStore(s => s.saveScheme);
  const resetFiltersToFullRange = useAppStore(s => s.resetFiltersToFullRange);
  const lastLoadedSchemeId = useAppStore(s => s.lastLoadedSchemeId);
  const baselineMarked = useAppStore(s => s.baselineMarked);
  const baselineTime = useAppStore(s => s.baselineTime);
  const markBaseline = useAppStore(s => s.markBaseline);
  const setCanvasDataUrl = useAppStore(s => s.setCanvasDataUrl);

  const filtered = useFilteredData();
  const selectedRecord = data.find(r => r.id === selectedId) || null;
  const cloudContainerRef = useRef<HTMLDivElement>(null);

  const [axisMapping, setAxisMapping] = useState<{ x: GreekAxis; y: GreekAxis; z: GreekAxis }>({
    x: 'delta',
    y: 'gamma',
    z: 'vega',
  });

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [schemeName, setSchemeName] = useState('');

  const handleCameraChange = useCallback((cam: CameraState) => {
    setCamera(cam);
  }, [setCamera]);

  useEffect(() => {
    if (data.length === 0) {
      navigate('/import');
    }
  }, [data, navigate]);

  const captureCanvas = () => {
    const canvas = document.querySelector('.react-three-fiber-canvas canvas') as HTMLCanvasElement;
    if (canvas) {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        setCanvasDataUrl(dataUrl);
        return dataUrl;
      } catch (e) {
        console.error('Canvas capture failed:', e);
        return null;
      }
    }
    return null;
  };

  const handleSaveScheme = () => {
    if (!schemeName.trim()) return;
    saveScheme(schemeName.trim());
    setShowSaveModal(false);
    setSchemeName('');
  };

  const handleExportScreenshot = () => {
    setTimeout(() => {
      captureCanvas();
    }, 50);
    setTimeout(() => {
      navigate('/export');
    }, 200);
  };

  return (
    <div ref={cloudContainerRef} className="h-full flex flex-col">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        onReset={resetFiltersToFullRange}
      />

      <div className="flex items-center gap-3 px-4 py-2 bg-[#1a1f36]/50 border-b border-slate-700/50">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">轴映射：</span>
          {(['x', 'y', 'z'] as const).map(axis => (
            <div key={axis} className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 uppercase">{axis}</span>
              <select
                value={axisMapping[axis]}
                onChange={e => setAxisMapping(prev => ({ ...prev, [axis]: e.target.value as GreekAxis }))}
                className="bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-cyan-500/50"
              >
                {axisOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {baselineMarked && baselineTime && (
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
            <Flag size={10} />
            基准已标记 · {formatDateTime(baselineTime)}
          </span>
        )}

        {lastLoadedSchemeId && (
          <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
            已加载方案
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={markBaseline}
            title="标记当前状态为基准（对应先跑一小包材料）"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
              baselineMarked
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-700/50 text-slate-300 border border-slate-600/50 hover:bg-slate-700'
            }`}
          >
            <Flag size={12} />
            {baselineMarked ? '已标记基准' : '标记基准状态'}
          </button>
          <button
            onClick={() => navigate('/import')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md transition-all"
          >
            <Database size={13} />
            换数据
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 rounded-md transition-all"
          >
            <Save size={13} />
            保存方案
          </button>
          <button
            onClick={handleExportScreenshot}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gradient-to-r from-cyan-500/80 to-blue-600/80 text-white hover:from-cyan-400 hover:to-blue-500 rounded-md transition-all"
          >
            <Camera size={13} />
            导出报告
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0">
          <Scene3D
            data={filtered}
            selectedId={selectedId}
            onSelect={setSelected}
            axisMapping={axisMapping}
            onCameraChange={handleCameraChange}
            initialCamera={storeCamera}
          />
        </div>

        {selectedRecord && (
          <div className="w-[380px] min-w-[380px] flex-shrink-0">
            <TracePanel record={selectedRecord} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1f36] border border-slate-700/50 rounded-xl p-6 w-96">
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
              <Layers size={16} className="text-amber-400" />
              保存当前方案
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              方案会保存当前的 3D 视角、筛选条件和标注状态，下次可直接加载
            </p>
            <input
              value={schemeName}
              onChange={e => setSchemeName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveScheme()}
              placeholder="方案名，比如'6月第一周异常汇总'"
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md transition-all"
              >
                取消
              </button>
              <button
                onClick={handleSaveScheme}
                disabled={!schemeName.trim()}
                className="px-4 py-2 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                确认保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
