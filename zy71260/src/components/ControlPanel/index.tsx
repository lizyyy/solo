import { useState } from 'react';
import { Filter, RotateCw, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { MODE_TYPE_COLORS, MODULATION_TYPE_COLORS, QUALITY_COLORS, CHORD_FUNCTION_COLORS } from '../../types';
import { getModeName, getModulationTypeName, getQualityName, getChordFunctionName } from '../../utils/musicTheory';

const modeTypes: Array<{ key: string; label: string }> = [
  { key: 'major', label: '大调' },
  { key: 'minor', label: '小调' },
  { key: 'dorian', label: '多利亚' },
  { key: 'phrygian', label: '弗里吉亚' },
  { key: 'lydian', label: '利底亚' },
  { key: 'mixolydian', label: '混合利底亚' },
  { key: 'aeolian', label: '爱奥尼亚' },
  { key: 'locrian', label: '洛克里亚' },
];

const modulationTypes: Array<{ key: string; label: string }> = [
  { key: 'direct', label: '直接转调' },
  { key: 'pivot', label: '中介和弦' },
  { key: 'sequential', label: '模进转调' },
  { key: 'enharmonic', label: '等音转调' },
];

const dataQualities: Array<{ key: string; label: string }> = [
  { key: 'normal', label: '正常数据' },
  { key: 'borderline', label: '临界数据' },
  { key: 'error', label: '错误数据' },
];

const chordFunctions: Array<{ key: string; label: string }> = [
  { key: 'tonic', label: '主和弦 (I)' },
  { key: 'supertonic', label: '上主和弦 (ii)' },
  { key: 'mediant', label: '中和弦 (iii)' },
  { key: 'subdominant', label: '下属和弦 (IV)' },
  { key: 'dominant', label: '属和弦 (V)' },
  { key: 'submediant', label: '下中和弦 (vi)' },
  { key: 'leading', label: '导和弦 (vii°)' },
];

interface FilterGroupProps {
  title: string;
  items: Array<{ key: string; label: string }>;
  selected: string[];
  onToggle: (key: string) => void;
  colorMap?: Record<string, string>;
}

const FilterGroup = ({ title, items, selected, onToggle, colorMap }: FilterGroupProps) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-colors"
      >
        <span className="text-sm font-medium text-slate-200">{title}</span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      
      {isOpen && (
        <div className="mt-2 space-y-1 pl-2">
          {items.map((item) => (
            <label
              key={item.key}
              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-700/30 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.includes(item.key as any)}
                onChange={() => onToggle(item.key)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
              />
              {colorMap && (
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colorMap[item.key] }}
                />
              )}
              <span className="text-sm text-slate-300">{item.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const ControlPanel = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const filters = useAppStore((state) => state.filters);
  const toggleModeType = useAppStore((state) => state.toggleModeType);
  const toggleChordFunction = useAppStore((state) => state.toggleChordFunction);
  const toggleModulationType = useAppStore((state) => state.toggleModulationType);
  const toggleDataQuality = useAppStore((state) => state.toggleDataQuality);
  const setShowBrokenPaths = useAppStore((state) => state.setShowBrokenPaths);
  const setShowMismatchedAudio = useAppStore((state) => state.setShowMismatchedAudio);
  const resetFilters = useAppStore((state) => state.resetFilters);
  const autoRotate = useAppStore((state) => state.autoRotate);
  const setAutoRotate = useAppStore((state) => state.setAutoRotate);

  if (isCollapsed) {
    return (
      <div className="fixed left-4 top-4 z-40">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-3 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/50 hover:bg-slate-800/90 transition-colors"
        >
          <Filter className="w-5 h-5 text-cyan-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed left-4 top-4 z-40 w-64 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-cyan-400" />
          <h2 className="font-semibold text-slate-100">筛选控制</h2>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-slate-700/50 rounded transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="p-4 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
        <FilterGroup
          title="调式类型"
          items={modeTypes}
          selected={filters.modeTypes}
          onToggle={toggleModeType}
          colorMap={MODE_TYPE_COLORS}
        />

        <FilterGroup
          title="和弦功能"
          items={chordFunctions}
          selected={filters.chordFunctions}
          onToggle={toggleChordFunction}
          colorMap={CHORD_FUNCTION_COLORS}
        />

        <FilterGroup
          title="转调类型"
          items={modulationTypes}
          selected={filters.modulationTypes}
          onToggle={toggleModulationType}
          colorMap={MODULATION_TYPE_COLORS}
        />

        <FilterGroup
          title="数据质量"
          items={dataQualities}
          selected={filters.dataQualities}
          onToggle={toggleDataQuality}
          colorMap={QUALITY_COLORS}
        />

        <div className="mb-4">
          <h3 className="text-sm font-medium text-slate-200 mb-2 px-1">特殊选项</h3>
          <label className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-700/30 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={filters.showBrokenPaths}
              onChange={(e) => setShowBrokenPaths(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
            />
            <span className="text-sm text-slate-300">显示断裂路径</span>
          </label>
          <label className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-700/30 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={filters.showMismatchedAudio}
              onChange={(e) => setShowMismatchedAudio(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
            />
            <span className="text-sm text-slate-300">显示错配音频</span>
          </label>
        </div>

        <button
          onClick={resetFilters}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-sm text-slate-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          重置筛选
        </button>

        <div className="mt-6 pt-4 border-t border-slate-700/50">
          <h3 className="text-sm font-medium text-slate-200 mb-3">相机控制</h3>
          <label className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-700/30 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={autoRotate}
              onChange={(e) => setAutoRotate(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
            />
            <RotateCw className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300">自动旋转</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
