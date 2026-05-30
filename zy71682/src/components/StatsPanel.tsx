import { List, AlertTriangle, Clock, FileDown, HardDrive } from 'lucide-react';
import type { BandRequirement, ExportRecord } from '@/types';
import { RequirementStatus } from '@/types';
import { formatDateTimeForDisplay } from '@/utils/helpers';

interface StatsPanelProps {
  requirements: BandRequirement[];
  exportHistory: ExportRecord[];
  lastSaved: string | null;
  onRunDetection: () => void;
  isDetecting?: boolean;
}

export function StatsPanel({
  requirements,
  exportHistory,
  lastSaved,
  onRunDetection,
  isDetecting
}: StatsPanelProps) {
  const pendingCount = requirements.filter(
    (r) => r.status === RequirementStatus.PENDING
  ).length;
  const conflictCount = requirements.filter(
    (r) => r.conflicts.some((c) => !c.resolved && c.severity === 'error')
  ).length;
  const totalChannels = requirements.reduce(
    (sum, r) => sum + r.channels.length,
    0
  );
  const totalMonitors = requirements.reduce(
    (sum, r) => sum + r.monitors.length,
    0
  );

  const stats = [
    {
      label: '总需求数',
      value: requirements.length,
      icon: List,
      color: 'text-neon-cyan',
      borderColor: 'border-neon-cyan'
    },
    {
      label: '待处理',
      value: pendingCount,
      icon: Clock,
      color: 'text-neon-orange',
      borderColor: 'border-neon-orange',
      pulse: pendingCount > 0
    },
    {
      label: '冲突数',
      value: conflictCount,
      icon: AlertTriangle,
      color: 'text-neon-red',
      borderColor: 'border-neon-red',
      pulse: conflictCount > 0
    },
    {
      label: '导出次数',
      value: exportHistory.length,
      icon: FileDown,
      color: 'text-neon-purple',
      borderColor: 'border-neon-purple'
    }
  ];

  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-neon-green" />
          系统状态
        </div>
        <button
          onClick={onRunDetection}
          disabled={isDetecting}
          className="btn btn-warning text-xs flex items-center gap-1"
        >
          <AlertTriangle className="w-3 h-3" />
          {isDetecting ? '检测中...' : '重新检测冲突'}
        </button>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`p-3 border-l-4 bg-base-800 ${stat.borderColor}`}
            >
              <div className="flex items-center gap-2">
                <stat.icon className={`w-4 h-4 ${stat.color} ${stat.pulse ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-mono text-base-500">{stat.label}</span>
              </div>
              <div className={`text-2xl font-display font-bold mt-1 ${stat.color}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-base-700 grid grid-cols-2 gap-4">
          <div className="text-xs font-mono text-base-500">
            通道总数: <span className="text-white">{totalChannels}</span>
          </div>
          <div className="text-xs font-mono text-base-500">
            返听总数: <span className="text-white">{totalMonitors}</span>
          </div>
        </div>

        {lastSaved && (
          <div className="mt-3 pt-3 border-t border-base-700 flex items-center gap-2 text-xs font-mono text-base-500">
            <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
            最后同步: {formatDateTimeForDisplay(lastSaved)}
          </div>
        )}
      </div>
    </div>
  );
}
