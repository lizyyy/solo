import { Layers, Users, Radio, Zap, Activity } from 'lucide-react';
import type { AcousticDataset } from '../../data/models/acoustic';
import type { Anomaly } from '../../data/models/anomalies';

interface StatusBarProps {
  dataset: AcousticDataset | null;
  anomalies: Anomaly[];
  filteredRayCount: number;
}

export function StatusBar({ dataset, anomalies, filteredRayCount }: StatusBarProps) {
  if (!dataset) return null;

  return (
    <div className="h-9 bg-slate-900/90 backdrop-blur-md border-t border-slate-700/50 flex items-center justify-between px-4">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-400">
            <span className="text-slate-300 font-mono">{dataset.materialFaces.length}</span> 个几何面
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-400">
            <span className="text-slate-300 font-mono">{dataset.seats.length}</span> 个座位
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-400">
            <span className="text-slate-300 font-mono">{dataset.soundSources.length}</span> 个声源
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-400">
            <span className="text-slate-300 font-mono">{filteredRayCount}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-500 font-mono">{dataset.rayPaths.length}</span> 条射线
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {anomalies.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-400/30">
            <Activity className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            <span className="text-xs text-red-400 font-medium">
              {anomalies.length} 个异常
              {anomalies.filter((a) => a.severity === 'high').length > 0 && (
                <span className="ml-1 text-red-300">
                  (高{anomalies.filter((a) => a.severity === 'high').length})
                </span>
              )}
            </span>
          </div>
        )}
        <div className="h-4 w-px bg-slate-700/50" />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-500">WebGL 正常运行</span>
        </div>
        <span className="text-xs text-slate-600">
          音乐厅混响声场可视化系统 v1.0
        </span>
      </div>
    </div>
  );
}
