import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, AlertTriangle, Lock, Lightbulb, Map, FileText, Palette } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { DataSource, DATA_SOURCE_LABELS, DATA_SOURCE_COLORS, ANOMALY_TYPE_LABELS } from '../../game/types';
import { SourceBadge } from '../common/SourceBadge';
import { StatusIndicator } from '../common/StatusIndicator';
import { formatGameTime } from '../../game/engine';

const sourceIcons: Record<DataSource, React.ReactNode> = {
  [DataSource.HALL]: <Eye size={14} />,
  [DataSource.ART]: <Palette size={14} />,
  [DataSource.DOOR]: <Lock size={14} />,
  [DataSource.LIGHT]: <Lightbulb size={14} />,
  [DataSource.ROUTE]: <Map size={14} />,
  [DataSource.REPORT]: <FileText size={14} />,
};

interface DataPanelItemProps {
  source: DataSource;
  title: string;
  children: React.ReactNode;
}

const DataPanelItem: React.FC<DataPanelItemProps> = ({ source, title, children }) => {
  const { markDataSourceViewed } = useGameStore();
  const { expandedPanels, togglePanel } = useUIStore();
  const isExpanded = expandedPanels[source];

  const handleToggle = () => {
    togglePanel(source);
    markDataSourceViewed(source);
  };

  const colorClass = DATA_SOURCE_COLORS[source];

  return (
    <div className={`panel border-t-2 ${colorClass.replace('text-', 'border-t-')} mb-3`}>
      <div
        className="panel-header cursor-pointer"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2">
          <SourceBadge source={source} />
          <span className="panel-title">{title}</span>
        </div>
        {isExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </div>
      {isExpanded && (
        <div className="p-3 max-h-64 overflow-y-auto scrollbar-thin">
          {children}
        </div>
      )}
    </div>
  );
};

export const DataPanel: React.FC = () => {
  const { state, updateReportDraft } = useGameStore();
  const [activeSource, setActiveSource] = useState<DataSource | null>(null);

  const pendingAnomalies = state.anomalies.filter(a => a.status === 'pending' && a.detectedTime !== null);

  const getHallStatus = (hallId: string) => {
    const hall = state.halls.find(h => h.id === hallId);
    if (!hall) return 'offline';
    if (!hall.isPatrolled) return 'warning';
    return 'online';
  };

  return (
    <div className="h-full flex flex-col">
      <div className="panel-header mb-2">
        <span className="panel-title">多源数据监控</span>
        {pendingAnomalies.length > 0 && (
          <span className="flex items-center gap-1 text-alert-red text-xs">
            <AlertTriangle size={12} className="animate-blink" />
            {pendingAnomalies.length} 个待处理
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin pr-1">
        <DataPanelItem source={DataSource.HALL} title="展厅状态">
          <div className="space-y-2">
            {state.halls.map(hall => (
              <div key={hall.id} className="flex items-center justify-between py-1 border-b border-gray-700/50">
                <div className="flex items-center gap-2">
                  <StatusIndicator status={getHallStatus(hall.id)} />
                  <span className="text-sm text-gray-300">{hall.name}</span>
                </div>
                <span className="text-xs text-gray-500 font-mono">
                  {hall.isPatrolled && hall.patrolTime !== null
                    ? `已巡 ${formatGameTime(hall.patrolTime)}`
                    : '未巡查'}
                </span>
              </div>
            ))}
            <div className="pt-2">
              <div className="text-xs text-gray-400 mb-1">角落巡查情况:</div>
              <div className="flex flex-wrap gap-1">
                {state.corners.map(corner => (
                  <span
                    key={corner.id}
                    className={`px-1.5 py-0.5 text-xs rounded ${
                      corner.isPatrolled
                        ? 'bg-alert-green/20 text-alert-green'
                        : 'bg-alert-red/20 text-alert-red'
                    }`}
                    title={corner.name}
                  >
                    {corner.isPatrolled ? '✓' : '!'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </DataPanelItem>

        <DataPanelItem source={DataSource.ART} title="作品传感器">
          <div className="space-y-2">
            {state.artworks.filter(a => a.vibrationSensor.enabled).map(art => {
              const isAnomaly = state.anomalies.some(
                a => a.relatedEntityId === art.id && a.status === 'pending' && a.detectedTime !== null
              );
              return (
                <div key={art.id} className="py-1 border-b border-gray-700/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300">{art.name}</span>
                    <StatusIndicator
                      status={isAnomaly ? 'danger' : art.vibrationSensor.currentValue > art.vibrationSensor.threshold * 0.7 ? 'warning' : 'online'}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-night-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isAnomaly ? 'bg-alert-red animate-pulse' : 'bg-source-art'
                        }`}
                        style={{ width: `${Math.min(100, (art.vibrationSensor.currentValue / art.vibrationSensor.threshold) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-gray-400">
                      {art.vibrationSensor.currentValue}/{art.vibrationSensor.threshold}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </DataPanelItem>

        <DataPanelItem source={DataSource.DOOR} title="门禁记录">
          <div className="space-y-2">
            {state.doors.filter(d => d.hallId).map(door => {
              const isAnomaly = state.anomalies.some(
                a => a.relatedEntityId === door.id && a.status === 'pending' && a.detectedTime !== null
              );
              const latestLog = door.accessLog[door.accessLog.length - 1];
              return (
                <div key={door.id} className="py-1 border-b border-gray-700/50">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Lock size={12} className="text-gray-400" />
                      <span className="text-sm text-gray-300">{door.name}</span>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      door.status === 'locked' ? 'bg-gray-600 text-gray-300' :
                      door.status === 'closed' ? 'bg-alert-green/20 text-alert-green' :
                      'bg-alert-yellow/20 text-alert-yellow'
                    }`}>
                      {door.status === 'locked' ? '已锁' : door.status === 'closed' ? '已关' : '开启'}
                    </span>
                  </div>
                  {latestLog && (
                    <div className="text-xs text-gray-500 font-mono">
                      {formatGameTime(latestLog.timestamp)} - {latestLog.details}
                    </div>
                  )}
                  {isAnomaly && (
                    <div className="mt-1 text-xs text-alert-red flex items-center gap-1">
                      <AlertTriangle size={10} />
                      异常告警
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DataPanelItem>

        <DataPanelItem source={DataSource.LIGHT} title="灯光控制">
          <div className="grid grid-cols-2 gap-2">
            {state.lights.filter(l => l.hallId).map(light => {
              const isAnomaly = state.anomalies.some(
                a => a.relatedEntityId === light.id && a.status === 'pending' && a.detectedTime !== null
              );
              return (
                <div
                  key={light.id}
                  className={`p-2 border ${isAnomaly ? 'border-alert-red bg-alert-red/5' : 'border-gray-700 bg-night-700'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Lightbulb
                      size={14}
                      className={light.status === 'fault' ? 'text-alert-red' : light.status === 'on' ? 'text-alert-yellow' : 'text-gray-500'}
                    />
                    <span className="text-xs text-gray-400 font-mono">
                      {light.brightness}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-300 truncate" title={light.name}>
                    {light.name.replace(/^.+?-\s*/, '')}
                  </div>
                </div>
              );
            })}
          </div>
        </DataPanelItem>

        <DataPanelItem source={DataSource.REPORT} title="夜巡报告">
          <div className="space-y-2">
            <textarea
              value={state.reportDraft}
              onChange={(e) => updateReportDraft(e.target.value)}
              placeholder="在此记录巡查发现和处理情况..."
              className="w-full h-32 bg-night-700 border border-gray-600 p-2 text-sm text-gray-300 resize-none focus:border-source-report focus:outline-none"
            />
            <div className="text-xs text-gray-500">
              已记录 {state.decisions.length} 个决策
            </div>
          </div>
        </DataPanelItem>
      </div>
    </div>
  );
};
