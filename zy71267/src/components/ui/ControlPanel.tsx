import { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Grid, Waves, Users, Radio } from 'lucide-react';
import type { DisplayParameter, RayFilterOptions } from '../../data/models/acoustic';
import { DISPLAY_PARAM_LABELS } from '../../data/models/acoustic';
import { PARAMETER_RANGES, createColorLegend } from '../../utils/colorMap';

interface ControlPanelProps {
  displayParam: DisplayParameter;
  rayFilter: RayFilterOptions;
  showHallWireframe: boolean;
  showRays: boolean;
  showSeats: boolean;
  showSources: boolean;
  onDisplayParamChange: (param: DisplayParameter) => void;
  onRayFilterChange: (options: Partial<RayFilterOptions>) => void;
  onToggleHallWireframe: () => void;
  onToggleRays: () => void;
  onToggleSeats: () => void;
  onToggleSources: () => void;
}

export function ControlPanel({
  displayParam,
  rayFilter,
  showHallWireframe,
  showRays,
  showSeats,
  showSources,
  onDisplayParamChange,
  onRayFilterChange,
  onToggleHallWireframe,
  onToggleRays,
  onToggleSeats,
  onToggleSources,
}: ControlPanelProps) {
  const [expandedSections, setExpandedSections] = useState({
    display: true,
    filter: true,
    visibility: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const displayParams: DisplayParameter[] = ['reverberationTime', 'soundPressureLevel', 'clarity'];
  const colorLegend = createColorLegend(displayParam, 5);

  return (
    <div className="w-72 bg-slate-900/90 backdrop-blur-md border-r border-slate-700/50 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-700/50">
        <h2 className="text-lg font-bold text-slate-100 tracking-wide">控制面板</h2>
        <p className="text-xs text-slate-400 mt-1">调整显示参数和筛选条件</p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="border-b border-slate-700/50">
          <button
            className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
            onClick={() => toggleSection('display')}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Grid className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-sm font-semibold text-slate-200">显示参数</span>
            </div>
            {expandedSections.display ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {expandedSections.display && (
            <div className="px-4 pb-4">
              <div className="space-y-2">
                {displayParams.map((param) => (
                  <button
                    key={param}
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      displayParam === param
                        ? 'bg-blue-500/30 border border-blue-400/50'
                        : 'bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50'
                    }`}
                    onClick={() => onDisplayParamChange(param)}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${displayParam === param ? 'text-blue-300' : 'text-slate-300'}`}>
                        {DISPLAY_PARAM_LABELS[param]}
                      </span>
                      {displayParam === param && (
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <p className="text-xs text-slate-400 mb-2">颜色图例</p>
                <div className="flex gap-1 h-6 rounded overflow-hidden">
                  {colorLegend.map((item, i) => (
                    <div
                      key={i}
                      className="flex-1 relative group"
                      style={{ backgroundColor: item.color }}
                    >
                      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {item.value.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-6">
                  <span className="text-xs text-slate-500">
                    {PARAMETER_RANGES[displayParam].min}
                  </span>
                  <span className="text-xs text-slate-500">
                    {PARAMETER_RANGES[displayParam].max}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-b border-slate-700/50">
          <button
            className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
            onClick={() => toggleSection('filter')}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Waves className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-sm font-semibold text-slate-200">路径筛选</span>
            </div>
            {expandedSections.filter ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {expandedSections.filter && (
            <div className="px-4 pb-4 space-y-4">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>反射阶数范围</span>
                  <span>{rayFilter.minOrder} - {rayFilter.maxOrder} 阶</span>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={rayFilter.minOrder}
                    onChange={(e) => onRayFilterChange({ minOrder: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={rayFilter.maxOrder}
                    onChange={(e) => onRayFilterChange({ maxOrder: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>最小能量阈值</span>
                  <span>{rayFilter.minEnergy.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={rayFilter.minEnergy}
                  onChange={(e) => onRayFilterChange({ minEnergy: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rayFilter.showOnlySelectedSeat}
                  onChange={(e) => onRayFilterChange({ showOnlySelectedSeat: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/20"
                />
                <span className="text-sm text-slate-300 group-hover:text-slate-200">
                  仅显示选中座位的路径
                </span>
              </label>
            </div>
          )}
        </div>

        <div>
          <button
            className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
            onClick={() => toggleSection('visibility')}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Eye className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-sm font-semibold text-slate-200">可见性控制</span>
            </div>
            {expandedSections.visibility ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {expandedSections.visibility && (
            <div className="px-4 pb-4 space-y-3">
              <VisibilityToggle
                icon={<Grid className="w-4 h-4" />}
                label="厅堂线框模式"
                checked={showHallWireframe}
                onChange={onToggleHallWireframe}
              />
              <VisibilityToggle
                icon={<Waves className="w-4 h-4" />}
                label="反射路径"
                checked={showRays}
                onChange={onToggleRays}
              />
              <VisibilityToggle
                icon={<Users className="w-4 h-4" />}
                label="座位区"
                checked={showSeats}
                onChange={onToggleSeats}
              />
              <VisibilityToggle
                icon={<Radio className="w-4 h-4" />}
                label="声源标记"
                checked={showSources}
                onChange={onToggleSources}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface VisibilityToggleProps {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: () => void;
}

function VisibilityToggle({ icon, label, checked, onChange }: VisibilityToggleProps) {
  return (
    <button
      className={`w-full p-3 rounded-lg flex items-center justify-between transition-all ${
        checked
          ? 'bg-emerald-500/20 border border-emerald-400/30'
          : 'bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50'
      }`}
      onClick={onChange}
    >
      <div className="flex items-center gap-2">
        <span className={checked ? 'text-emerald-400' : 'text-slate-500'}>{icon}</span>
        <span className={`text-sm ${checked ? 'text-emerald-300' : 'text-slate-400'}`}>{label}</span>
      </div>
      {checked ? (
        <Eye className="w-4 h-4 text-emerald-400" />
      ) : (
        <EyeOff className="w-4 h-4 text-slate-600" />
      )}
    </button>
  );
}
