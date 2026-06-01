import React from 'react';
import { ListTodo, AlertCircle, FolderKanban } from 'lucide-react';
import { useStore, useFilteredPoints } from '../../store/useStore';
import { PointCard } from './PointCard';
import { AnomalyDetail } from './AnomalyDetail';
import { SchemeManager } from './SchemeManager';

export const RightPanel: React.FC = () => {
  const { selectedPointId, setSelectedPoint, panelTab, setPanelTab } = useStore();
  const filteredPoints = useFilteredPoints();

  const tabs = [
    { id: 'trace' as const, label: '溯源列表', icon: ListTodo },
    { id: 'anomaly' as const, label: '异常详情', icon: AlertCircle },
    { id: 'scheme' as const, label: '方案管理', icon: FolderKanban },
  ];

  return (
    <div className="w-96 h-full bg-slate-900/95 border-l border-slate-700/50 flex flex-col backdrop-blur-sm">
      <div className="flex border-b border-slate-700/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPanelTab(tab.id)}
            className={`flex-1 px-4 py-3 text-xs flex items-center justify-center gap-2 border-b-2 transition-all ${
              panelTab === tab.id
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.id === 'trace' && filteredPoints.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-slate-700 rounded">
                {filteredPoints.length}
              </span>
            )}
            {tab.id === 'anomaly' && selectedPointId && (
              <span className="w-2 h-2 bg-cyan-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {panelTab === 'trace' && (
          <div className="h-full overflow-y-auto p-3 space-y-2">
            {filteredPoints.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                <div className="text-center">
                  <p>无符合条件的点位</p>
                  <p className="text-xs mt-1">请调整筛选条件</p>
                </div>
              </div>
            ) : (
              filteredPoints.map((point) => (
                <PointCard
                  key={point.id}
                  point={point}
                  isSelected={point.id === selectedPointId}
                  onClick={() => {
                    setSelectedPoint(point.id);
                    setPanelTab('anomaly');
                  }}
                />
              ))
            )}
          </div>
        )}

        {panelTab === 'anomaly' && <AnomalyDetail />}

        {panelTab === 'scheme' && <SchemeManager />}
      </div>
    </div>
  );
};
