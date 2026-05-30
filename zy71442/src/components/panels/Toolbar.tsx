import { useState } from 'react';
import {
  Upload,
  Download,
  Eye,
  EyeOff,
  RotateCcw,
  History,
  Maximize2,
  Minimize2,
  Grid,
  Axis3d,
  Camera,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Toggle } from '../ui/Toggle';
import type { ViewState } from '../../types/surface';

interface ToolbarProps {
  viewState: ViewState;
  onImport?: () => void;
  onExport?: () => void;
  onReview?: () => void;
  onViewStateChange?: (state: Partial<ViewState>) => void;
  onResetCamera?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  className?: string;
}

export function Toolbar({
  viewState,
  onImport,
  onExport,
  onReview,
  onViewStateChange,
  onResetCamera,
  onToggleFullscreen,
  isFullscreen = false,
  className,
}: ToolbarProps) {
  const [showViewOptions, setShowViewOptions] = useState(false);

  const viewToggles = [
    { key: 'showSurface', label: '曲面', icon: Grid },
    { key: 'showNormals', label: '法向量', icon: Axis3d },
    { key: 'showBoundary', label: '边界', icon: Grid },
    { key: 'showSamples', label: '采样点', icon: Grid },
    { key: 'showProjection', label: '投影', icon: Grid },
  ] as const;

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2.5 bg-slate-900/95 backdrop-blur border-b border-slate-700',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-3 pr-4 border-r border-slate-700">
          <button
            onClick={onImport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            导入
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            导出
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 border-r border-slate-700">
          <button
            onClick={onResetCamera}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置相机
          </button>
          <button
            onClick={onToggleFullscreen}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            {isFullscreen ? '退出全屏' : '全屏'}
          </button>
        </div>

        <div className="relative px-4">
          <button
            onClick={() => setShowViewOptions(!showViewOptions)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
            视图选项
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 transition-transform',
                showViewOptions && 'rotate-180'
              )}
            />
          </button>

          {showViewOptions && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowViewOptions(false)}
              />
              <div className="absolute left-4 top-full mt-2 z-50 w-64 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-xl">
                <h4 className="text-xs font-semibold text-slate-300 mb-3">显示控制</h4>
                <div className="space-y-2">
                  {viewToggles.map((toggle) => {
                    const Icon = toggle.icon;
                    const isChecked = viewState[toggle.key];
                    return (
                      <div
                        key={toggle.key}
                        className="flex items-center justify-between py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          {isChecked ? (
                            <Eye className="w-3.5 h-3.5 text-blue-400" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span className="text-xs text-slate-300">{toggle.label}</span>
                        </div>
                        <Toggle
                          checked={isChecked}
                          onCheckedChange={(checked) =>
                            onViewStateChange?.({ [toggle.key]: checked })
                          }
                          size="sm"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-600">
                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs text-slate-300">高亮反向法向量</span>
                    </div>
                    <Toggle
                      checked={viewState.highlightReversedNormals}
                      onCheckedChange={(checked) =>
                        onViewStateChange?.({ highlightReversedNormals: checked })
                      }
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-xs text-slate-400">
          <span className="text-slate-300 font-medium">曲面积分讲台</span>
          <span className="mx-2 text-slate-600">|</span>
          <span>曲面可视化与诊断系统</span>
        </div>
        <div className="w-px h-5 bg-slate-700" />
        <button
          onClick={onReview}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors"
        >
          <History className="w-3.5 h-3.5" />
          复盘
        </button>
      </div>
    </div>
  );
}
