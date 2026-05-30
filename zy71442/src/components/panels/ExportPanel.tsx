import { useState } from 'react';
import {
  X,
  Download,
  Settings2,
  Lock,
  Unlock,
  Maximize2,
  FileJson,
  FileSpreadsheet,
  FileCode,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Slider, RangeSlider } from '../ui/Slider';
import { Toggle } from '../ui/Toggle';
import type { FilterRange, SliceParams, DataMaterial } from '../../types/surface';
import { useSurfaceStore } from '../../stores/useSurfaceStore';
import { useViewStore } from '../../stores/useViewStore';
import { useFilterStore } from '../../stores/useFilterStore';

interface ExportPanelProps {
  onClose: () => void;
  onExport?: () => void;
  className?: string;
}

interface ExportOptions {
  includeNormals: boolean;
  includeUVs: boolean;
  includeBoundary: boolean;
  includeSamplePoints: boolean;
  applyFilter: boolean;
  applySlice: boolean;
  selectedMaterialIds: string[];
  precision: number;
}

export function ExportPanel({
  onClose,
  onExport,
  className,
}: ExportPanelProps) {
  const materials = useSurfaceStore((state) => state.materials);
  const { sliceParams } = useViewStore();
  const { filterRange, locked, setLocked, setFilterRange } = useFilterStore();
  const { setSliceParams } = useViewStore();
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'obj'>('json');
  const [options, setOptions] = useState<ExportOptions>({
    includeNormals: true,
    includeUVs: true,
    includeBoundary: true,
    includeSamplePoints: true,
    applyFilter: true,
    applySlice: true,
    selectedMaterialIds: materials.map((m) => m.id),
    precision: 6,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const formatOptions = [
    { value: 'json', label: 'JSON', icon: FileJson, desc: '完整数据格式' },
    { value: 'csv', label: 'CSV', icon: FileSpreadsheet, desc: '表格数据格式' },
    { value: 'obj', label: 'OBJ', icon: FileCode, desc: '3D模型格式' },
  ];

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsExporting(false);
          onExport?.();
          return 100;
        }
        return prev + 10;
      });
    }, 100);
  };

  const toggleMaterial = (id: string) => {
    setOptions((prev) => ({
      ...prev,
      selectedMaterialIds: prev.selectedMaterialIds.includes(id)
        ? prev.selectedMaterialIds.filter((mid) => mid !== id)
        : [...prev.selectedMaterialIds, id],
    }));
  };

  const selectAllMaterials = () => {
    setOptions((prev) => ({
      ...prev,
      selectedMaterialIds: materials.map((m) => m.id),
    }));
  };

  const deselectAllMaterials = () => {
    setOptions((prev) => ({
      ...prev,
      selectedMaterialIds: [],
    }));
  };

  const getRangeDisplay = (range?: [number, number]) => {
    if (!range) return '自动';
    return `[${range[0].toFixed(2)}, ${range[1].toFixed(2)}]`;
  };

  const estimatedPoints = materials
    .filter((m) => options.selectedMaterialIds.includes(m.id))
    .reduce((sum, m) => sum + (m.points?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full max-w-4xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden',
          className
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100">导出数据</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-4">
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                    范围预览
                  </h4>
                  <button
                    onClick={() => setLocked(!locked)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors',
                      locked
                        ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                        : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'
                    )}
                  >
                    {locked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                    {locked ? '已锁定' : '锁定视图'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="p-2 bg-slate-900/50 rounded-md">
                    <div className="text-[10px] text-slate-500 mb-1">X 轴范围</div>
                    <div className="text-xs font-mono text-slate-300">
                      {getRangeDisplay(filterRange.x)}
                    </div>
                  </div>
                  <div className="p-2 bg-slate-900/50 rounded-md">
                    <div className="text-[10px] text-slate-500 mb-1">Y 轴范围</div>
                    <div className="text-xs font-mono text-slate-300">
                      {getRangeDisplay(filterRange.y)}
                    </div>
                  </div>
                  <div className="p-2 bg-slate-900/50 rounded-md">
                    <div className="text-[10px] text-slate-500 mb-1">Z 轴范围</div>
                    <div className="text-xs font-mono text-slate-300">
                      {getRangeDisplay(filterRange.z)}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <RangeSlider
                    label="X 轴筛选"
                    value={filterRange.x || [-1, 1]}
                    min={-10}
                    max={10}
                    step={0.1}
                    disabled={locked}
                    onChange={(range) => setFilterRange({ x: range })}
                  />
                  <RangeSlider
                    label="Y 轴筛选"
                    value={filterRange.y || [-1, 1]}
                    min={-10}
                    max={10}
                    step={0.1}
                    disabled={locked}
                    onChange={(range) => setFilterRange({ y: range })}
                  />
                  <RangeSlider
                    label="Z 轴筛选"
                    value={filterRange.z || [-1, 1]}
                    min={-10}
                    max={10}
                    step={0.1}
                    disabled={locked}
                    onChange={(range) => setFilterRange({ z: range })}
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <h4 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-purple-400" />
                  参数筛选
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <RangeSlider
                    label="U 参数范围"
                    value={[sliceParams.uMin, sliceParams.uMax]}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(range) =>
                      setSliceParams({ uMin: range[0], uMax: range[1] })
                    }
                  />
                  <RangeSlider
                    label="V 参数范围"
                    value={[sliceParams.vMin, sliceParams.vMax]}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(range) =>
                      setSliceParams({ vMin: range[0], vMax: range[1] })
                    }
                  />
                </div>
                <div className="mt-3">
                  <Slider
                    label="数值精度"
                    value={options.precision}
                    min={2}
                    max={12}
                    step={1}
                    unit="位"
                    onChange={(val) => setOptions((prev) => ({ ...prev, precision: val }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <h4 className="text-xs font-semibold text-slate-300 mb-3">导出格式</h4>
                <div className="space-y-2">
                  {formatOptions.map((fmt) => {
                    const Icon = fmt.icon;
                    const isActive = exportFormat === fmt.value;
                    return (
                      <button
                        key={fmt.value}
                        onClick={() => setExportFormat(fmt.value as 'json' | 'csv' | 'obj')}
                        className={cn(
                          'w-full flex items-center gap-2 p-2 rounded-md border text-left transition-colors',
                          isActive
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-900/50 border-slate-600 text-slate-300 hover:bg-slate-700/50'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <div>
                          <div className="text-xs font-medium">{fmt.label}</div>
                          <div className="text-[10px] text-slate-500">{fmt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <h4 className="text-xs font-semibold text-slate-300 mb-3">导出选项</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-400">包含法向量</span>
                    <Toggle
                      checked={options.includeNormals}
                      onCheckedChange={(checked) =>
                        setOptions((prev) => ({ ...prev, includeNormals: checked }))
                      }
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-400">包含UV坐标</span>
                    <Toggle
                      checked={options.includeUVs}
                      onCheckedChange={(checked) =>
                        setOptions((prev) => ({ ...prev, includeUVs: checked }))
                      }
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-400">包含边界</span>
                    <Toggle
                      checked={options.includeBoundary}
                      onCheckedChange={(checked) =>
                        setOptions((prev) => ({ ...prev, includeBoundary: checked }))
                      }
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-400">包含采样点</span>
                    <Toggle
                      checked={options.includeSamplePoints}
                      onCheckedChange={(checked) =>
                        setOptions((prev) => ({ ...prev, includeSamplePoints: checked }))
                      }
                      size="sm"
                    />
                  </div>
                  <div className="border-t border-slate-700 my-2" />
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-400">应用范围筛选</span>
                    <Toggle
                      checked={options.applyFilter}
                      onCheckedChange={(checked) =>
                        setOptions((prev) => ({ ...prev, applyFilter: checked }))
                      }
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-400">应用参数切片</span>
                    <Toggle
                      checked={options.applySlice}
                      onCheckedChange={(checked) =>
                        setOptions((prev) => ({ ...prev, applySlice: checked }))
                      }
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-slate-300">选择材料</h4>
                  <div className="flex gap-1">
                    <button
                      onClick={selectAllMaterials}
                      className="text-[10px] text-blue-400 hover:text-blue-300"
                    >
                      全选
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      onClick={deselectAllMaterials}
                      className="text-[10px] text-slate-500 hover:text-slate-400"
                    >
                      清空
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {materials.map((material) => {
                    const isSelected = options.selectedMaterialIds.includes(material.id);
                    return (
                      <button
                        key={material.id}
                        onClick={() => toggleMaterial(material.id)}
                        className={cn(
                          'w-full flex items-center gap-2 p-1.5 rounded text-left transition-colors',
                          isSelected
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'hover:bg-slate-700/50 text-slate-400'
                        )}
                      >
                        <div
                          className={cn(
                            'w-3 h-3 rounded border flex items-center justify-center',
                            isSelected
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-slate-600'
                          )}
                        >
                          {isSelected && <CheckCircle2 className="w-2 h-2 text-white" />}
                        </div>
                        <span className="text-xs truncate">{material.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-medium text-slate-300">导出预估</span>
                </div>
                <div className="text-[11px] text-slate-400 space-y-0.5">
                  <div className="flex justify-between">
                    <span>已选材料</span>
                    <span className="text-slate-300 font-mono">
                      {options.selectedMaterialIds.length}/{materials.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>预估点数</span>
                    <span className="text-slate-300 font-mono">{estimatedPoints}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 bg-slate-800/30">
          {isExporting && (
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 font-mono">{exportProgress}%</span>
            </div>
          )}
          {!isExporting && <div className="flex-1" />}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || options.selectedMaterialIds.length === 0}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md transition-colors',
                isExporting || options.selectedMaterialIds.length === 0
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              )}
            >
              {isExporting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {isExporting ? '导出中...' : '开始导出'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
