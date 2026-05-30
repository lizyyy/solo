import {
  Move3d,
  Ruler,
  Grid3X3,
  Square,
  PanelBottom,
  PanelRight,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Slider, RangeSlider } from '../ui/Slider';
import { Toggle } from '../ui/Toggle';
import type { SliceParams, ProjectionPlane, ViewState } from '../../types/surface';

interface ControlBarProps {
  viewState: ViewState;
  onSliceParamsChange?: (params: SliceParams) => void;
  onNormalLengthChange?: (length: number) => void;
  onNormalDensityChange?: (density: number) => void;
  onProjectionPlaneChange?: (plane: ProjectionPlane) => void;
  onShowNormalsChange?: (show: boolean) => void;
  onShowProjectionChange?: (show: boolean) => void;
  onReset?: () => void;
  className?: string;
}

export function ControlBar({
  viewState,
  onSliceParamsChange,
  onNormalLengthChange,
  onNormalDensityChange,
  onProjectionPlaneChange,
  onShowNormalsChange,
  onShowProjectionChange,
  onReset,
  className,
}: ControlBarProps) {
  const projectionPlanes: { value: ProjectionPlane; label: string; icon: typeof Square }[] = [
    { value: 'xy', label: 'XY', icon: Square },
    { value: 'xz', label: 'XZ', icon: PanelBottom },
    { value: 'yz', label: 'YZ', icon: PanelRight },
  ];

  const handleURangeChange = (range: [number, number]) => {
    onSliceParamsChange?.({
      ...viewState.sliceParams,
      uMin: range[0],
      uMax: range[1],
    });
  };

  const handleVRangeChange = (range: [number, number]) => {
    onSliceParamsChange?.({
      ...viewState.sliceParams,
      vMin: range[0],
      vMax: range[1],
    });
  };

  return (
    <div
      className={cn(
        'flex items-stretch gap-4 p-3 bg-slate-900/95 backdrop-blur border-t border-slate-700',
        className
      )}
    >
      <div className="flex-1 flex items-center gap-4">
        <div className="w-52">
          <RangeSlider
            label={
              <span className="flex items-center gap-1">
                <Grid3X3 className="w-3 h-3 text-blue-400" />
                U 参数范围
              </span>
            }
            value={[viewState.sliceParams.uMin, viewState.sliceParams.uMax]}
            min={0}
            max={1}
            step={0.01}
            onChange={handleURangeChange}
          />
        </div>

        <div className="w-52">
          <RangeSlider
            label={
              <span className="flex items-center gap-1">
                <Grid3X3 className="w-3 h-3 text-emerald-400" />
                V 参数范围
              </span>
            }
            value={[viewState.sliceParams.vMin, viewState.sliceParams.vMax]}
            min={0}
            max={1}
            step={0.01}
            onChange={handleVRangeChange}
          />
        </div>

        <div className="w-px h-full bg-slate-700" />

        <div className="w-40">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-400">
              <Move3d className="w-3 h-3 text-purple-400" />
              显示法向量
            </label>
            <Toggle
              checked={viewState.showNormals}
              onCheckedChange={(checked) => onShowNormalsChange?.(checked)}
              size="sm"
            />
          </div>
          <Slider
            value={viewState.normalLength}
            min={0.05}
            max={0.5}
            step={0.01}
            disabled={!viewState.showNormals}
            label="长度"
            unit=""
            onChange={onNormalLengthChange}
          />
        </div>

        <div className="w-40">
          <Slider
            value={viewState.normalDensity}
            min={0.05}
            max={0.5}
            step={0.01}
            disabled={!viewState.showNormals}
            label={
              <span className="flex items-center gap-1">
                <Ruler className="w-3 h-3 text-amber-400" />
                密度
              </span>
            }
            unit=""
            onChange={onNormalDensityChange}
          />
        </div>

        <div className="w-px h-full bg-slate-700" />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-400">
              <Square className="w-3 h-3 text-cyan-400" />
              投影平面
            </label>
            <Toggle
              checked={viewState.showProjection}
              onCheckedChange={(checked) => onShowProjectionChange?.(checked)}
              size="sm"
            />
          </div>
          <div className="flex gap-1">
            {projectionPlanes.map((plane) => {
              const PlaneIcon = plane.icon;
              const isActive = viewState.projectionPlane === plane.value;
              return (
                <button
                  key={plane.value}
                  onClick={() => onProjectionPlaneChange?.(plane.value)}
                  disabled={!viewState.showProjection}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border transition-colors',
                    isActive
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700',
                    !viewState.showProjection && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <PlaneIcon className="w-3 h-3" />
                  {plane.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-px h-full bg-slate-700" />

      <button
        onClick={onReset}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition-colors self-center"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        重置视图
      </button>
    </div>
  );
}
