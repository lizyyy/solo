import { useState } from 'react';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { StatsPanel } from './StatsPanel';
import { PowerPointsList } from './PowerPointsList';
import { SensorsList } from './SensorsList';
import { AnomaliesPanel } from './AnomaliesPanel';

export const SidePanel = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'anomalies'>('data');

  return (
    <div
      className={`h-full bg-slate-900/80 backdrop-blur-md border-l border-slate-700/50 transition-all duration-300 flex flex-col ${
        isCollapsed ? 'w-12' : 'w-80'
      }`}
    >
      <div className="flex items-center justify-between p-3 border-b border-slate-700/50">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h2 className="font-semibold text-slate-200">数据面板</h2>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
        >
          {isCollapsed ? (
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>

      {!isCollapsed && (
        <>
          <div className="flex border-b border-slate-700/50">
            <button
              onClick={() => setActiveTab('data')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeTab === 'data'
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              数据明细
            </button>
            <button
              onClick={() => setActiveTab('anomalies')}
              className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
                activeTab === 'anomalies'
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              异常检测
              <span className="absolute top-1 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {activeTab === 'data' ? (
              <>
                <StatsPanel />
                <PowerPointsList />
                <SensorsList />
              </>
            ) : (
              <AnomaliesPanel />
            )}
          </div>
        </>
      )}

      {isCollapsed && (
        <div className="flex-1 flex flex-col items-center py-4 gap-4">
          <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400" title="数据面板">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      )}
    </div>
  );
};
