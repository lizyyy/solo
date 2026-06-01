import { useAppStore } from '@/store/useAppStore';
import { Settings, RotateCcw, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

export function ParamsPanel() {
  const { params, setParams, view, setView, resetView } = useAppStore((state) => ({
    params: state.params,
    setParams: state.setParams,
    view: state.view,
    setView: state.setView,
    resetView: state.resetView,
  }));

  const handleDistanceThresholdChange = (value: number) => {
    setParams({ distanceThreshold: value });
  };

  const handleCoordToleranceChange = (value: number) => {
    setParams({ coordTolerance: value });
  };

  const handleCoordSystemChange = (value: 'A' | 'B' | 'separate') => {
    setParams({ coordSystemHandling: value });
  };

  return (
    <div className="h-full bg-bg-secondary border-r border-border-subtle flex flex-col">
      <div className="p-4 border-b border-border-subtle">
        <div className="flex items-center gap-2 text-text-primary">
          <Settings className="w-5 h-5" />
          <h2 className="font-semibold">参数设置</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-text-secondary">
            诱导距离阈值
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="10"
              max="100"
              value={params.distanceThreshold}
              onChange={(e) => handleDistanceThresholdChange(Number(e.target.value))}
              className="flex-1 h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-accent-blue"
            />
            <span className="w-16 text-right font-mono text-text-primary">
              {params.distanceThreshold}m
            </span>
          </div>
          <p className="text-xs text-text-muted">
            设备间超过此距离视为独立诱导单元
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-text-secondary">
            坐标容差
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={params.coordTolerance}
              onChange={(e) => handleCoordToleranceChange(Number(e.target.value))}
              className="flex-1 h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-accent-blue"
            />
            <span className="w-16 text-right font-mono text-text-primary">
              {params.coordTolerance}m
            </span>
          </div>
          <p className="text-xs text-text-muted">
            CAD与现场坐标差在此范围内视为匹配
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-text-secondary">
            坐标系处理方式
          </label>
          <div className="space-y-2">
            {[
              { value: 'separate', label: '分别渲染', desc: '不同坐标系分开显示' },
              { value: 'A', label: '统一到A系', desc: '以A坐标系为准' },
              { value: 'B', label: '统一到B系', desc: '以B坐标系为准' },
            ].map((option) => (
              <label
                key={option.value}
                className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
                  params.coordSystemHandling === option.value
                    ? 'border-accent-blue bg-accent-blue/10'
                    : 'border-border-subtle hover:border-text-muted'
                }`}
              >
                <input
                  type="radio"
                  name="coordSystem"
                  value={option.value}
                  checked={params.coordSystemHandling === option.value}
                  onChange={(e) => handleCoordSystemChange(e.target.value as 'A' | 'B' | 'separate')}
                  className="mt-1 accent-accent-blue"
                />
                <div>
                  <div className="text-sm font-medium text-text-primary">{option.label}</div>
                  <div className="text-xs text-text-muted">{option.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-border-subtle pt-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">视图控制</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setView({ zoom: Math.min(5, view.zoom * 1.2) })}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-bg-tertiary hover:bg-border-subtle rounded text-sm transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
              放大
            </button>
            <button
              onClick={() => setView({ zoom: Math.max(0.2, view.zoom / 1.2) })}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-bg-tertiary hover:bg-border-subtle rounded text-sm transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
              缩小
            </button>
            <button
              onClick={() => setView({ rotation: (view.rotation + 90) % 360 })}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-bg-tertiary hover:bg-border-subtle rounded text-sm transition-colors"
            >
              <RotateCw className="w-4 h-4" />
              旋转
            </button>
            <button
              onClick={resetView}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-bg-tertiary hover:bg-border-subtle rounded text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              重置
            </button>
          </div>
        </div>

        <div className="border-t border-border-subtle pt-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">当前状态</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">缩放比例</span>
              <span className="font-mono text-text-primary">{(view.zoom * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">旋转角度</span>
              <span className="font-mono text-text-primary">{view.rotation}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">当前楼层</span>
              <span className="font-mono text-text-primary">{view.currentFloor}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
