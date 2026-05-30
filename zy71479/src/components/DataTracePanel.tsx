import { Circle, Clock, Database, Gauge, Navigation, Target } from 'lucide-react';
import type { CornerData } from '../types';
import { getStatusColor, getStatusText } from '../utils/calculations';

interface DataTracePanelProps {
  corner: CornerData | null;
}

const DataTracePanel = ({ corner }: DataTracePanelProps) => {
  if (!corner) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <Target className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">点击赛道上的弯道查看数据溯源</p>
        </div>
      </div>
    );
  }

  const statusColor = getStatusColor(corner.status);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">{corner.cornerName}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusColor }}
            ></span>
            <span className="text-xs" style={{ color: statusColor }}>
              {getStatusText(corner.status)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{corner.gripUtilization || '-'}%</div>
          <div className="text-xs text-slate-400">抓地利用率</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-white">车速数据</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-lg font-semibold text-white">{corner.speed.value}</div>
              <div className="text-xs text-slate-400">km/h</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-300">{(corner.speed.confidence * 100).toFixed(0)}%</div>
              <div className="text-xs text-slate-400">置信度</div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-700/50">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Database className="w-3 h-3" />
              <span className="truncate">{corner.speed.source}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <Clock className="w-3 h-3" />
              <span>{corner.speed.timestamp}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center gap-2 mb-2">
            <Navigation className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-white">转弯半径</span>
            {corner.radius.isCorrected && (
              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">已修正</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-lg font-semibold text-white">{corner.radius.value}</div>
              <div className="text-xs text-slate-400">米</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-300">{(corner.radius.confidence * 100).toFixed(0)}%</div>
              <div className="text-xs text-slate-400">置信度</div>
            </div>
          </div>
          {corner.radius.isCorrected && (
            <div className="mt-2 text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
              原始值: {corner.radius.originalValue}m → 修正后: {corner.radius.value}m
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-slate-700/50">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Database className="w-3 h-3" />
              <span className="truncate">{corner.radius.source}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <Clock className="w-3 h-3" />
              <span>{corner.radius.timestamp}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center gap-2 mb-2">
            <Circle className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">轮胎数据</span>
            {corner.tire.isMissing && (
              <span className="px-1.5 py-0.5 bg-slate-500/20 text-slate-400 text-xs rounded">待补充</span>
            )}
          </div>
          {corner.tire.isMissing ? (
            <div className="text-sm text-slate-500 italic">轮胎数据缺失，需要人工补充</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-sm font-semibold text-white">{corner.tire.type}</div>
                  <div className="text-xs text-slate-400">类型</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white">{corner.tire.compound}</div>
                  <div className="text-xs text-slate-400">配方</div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-700/50">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Database className="w-3 h-3" />
                  <span className="truncate">{corner.tire.source}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <Clock className="w-3 h-3" />
                  <span>{corner.tire.timestamp}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataTracePanel;
