import React from 'react';
import { X, FileText, ClipboardList, Wrench, Clock, User, MapPin } from 'lucide-react';
import type { ShiftRecord, WorkLog, MaintenanceOrder, SourceType } from '@/types';
import { SHIFT_LABELS, SOURCE_TYPE_LABELS, STATUS_LABELS } from '@/types';
import { useUIStore } from '@/stores/uiStore';
import { useRecordsStore } from '@/stores/recordsStore';
import { formatDateTime, cn } from '@/utils/helpers';
import { StatusBadge } from './StatusBadge';

const SourceIcon: Record<SourceType, React.FC<{ className?: string }>> = {
  shift_record: FileText,
  work_log: ClipboardList,
  maintenance: Wrench,
  maintenance_order: Wrench,
};

export const SourcePanel: React.FC = () => {
  const {
    sourcePanelOpen,
    activeSourcePanel,
    setSourcePanelOpen,
    highlightLineNumber,
  } = useUIStore();

  const {
    selectedShiftRecord,
    selectedWorkLog,
    selectedMaintenanceOrder,
    loading,
  } = useRecordsStore();

  if (!sourcePanelOpen || !activeSourcePanel) return null;

  const Icon = SourceIcon[activeSourcePanel];

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tech-blue" />
        </div>
      );
    }

    switch (activeSourcePanel) {
      case 'shift_record':
        return selectedShiftRecord ? (
          <ShiftRecordContent record={selectedShiftRecord} highlightLine={highlightLineNumber} />
        ) : (
          <EmptyState type="shift_record" />
        );
      case 'work_log':
        return selectedWorkLog ? (
          <WorkLogContent log={selectedWorkLog} highlightLine={highlightLineNumber} />
        ) : (
          <EmptyState type="work_log" />
        );
      case 'maintenance':
        return selectedMaintenanceOrder ? (
          <MaintenanceContent order={selectedMaintenanceOrder} />
        ) : (
          <EmptyState type="maintenance" />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-industrial-bg-light border-l border-industrial-border shadow-industrial z-50 flex flex-col animate-slide-in-right">
      <div className="flex items-center justify-between px-4 py-3 border-b border-industrial-border">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-tech-blue" />
          <span className="font-medium text-industrial-text">
            {SOURCE_TYPE_LABELS[activeSourcePanel]}
          </span>
        </div>
        <button
          onClick={() => setSourcePanelOpen(false)}
          className="p-1.5 hover:bg-industrial-bg-lighter rounded transition-colors text-industrial-text-muted hover:text-industrial-text"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {renderContent()}
      </div>
    </div>
  );
};

interface ContentProps {
  highlightLine?: number | null;
}

const ShiftRecordContent: React.FC<{ record: ShiftRecord } & ContentProps> = ({
  record,
  highlightLine,
}) => {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-industrial-bg rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-tech-blue/20 text-tech-blue text-xs font-medium rounded">
              {SHIFT_LABELS[record.shift]}
            </span>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-industrial-text-muted">
            <User className="w-4 h-4" />
            <span>操作员: {record.operator}</span>
          </div>
          <div className="flex items-center gap-2 text-industrial-text-muted">
            <Clock className="w-4 h-4" />
            <span>记录时间: {formatDateTime(record.recordTime)}</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-industrial-text mb-2">记录内容</h4>
        <div className="p-3 bg-industrial-bg rounded-lg text-sm text-industrial-text whitespace-pre-wrap">
          {record.content}
        </div>
      </div>

      {record.anomalies && (
        <div>
          <h4 className="text-sm font-medium text-alert-orange mb-2">异常情况</h4>
          <div className="p-3 bg-alert-orange/10 border border-alert-orange/30 rounded-lg text-sm text-alert-orange whitespace-pre-wrap">
            {record.anomalies}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-sm font-medium text-industrial-text mb-2">压力读数</h4>
        <div className="bg-industrial-bg rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-industrial-border">
                <th className="px-3 py-2 text-left text-industrial-text-muted font-medium">时间</th>
                <th className="px-3 py-2 text-left text-industrial-text-muted font-medium">位置</th>
                <th className="px-3 py-2 text-right text-industrial-text-muted font-medium">压力</th>
              </tr>
            </thead>
            <tbody className="table-zebra">
              {record.pressureReadings.map((reading, idx) => (
                <tr
                  key={idx}
                  className={cn(
                    'border-b border-industrial-border/50',
                    highlightLine === idx + 1 && 'bg-tech-blue/20'
                  )}
                >
                  <td className="px-3 py-2 text-industrial-text-muted font-mono text-xs">
                    {formatDateTime(reading.timestamp)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-industrial-text-dim" />
                      {reading.location}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium">
                    <span style={{ color: reading.pressure >= 8 ? '#ff9500' : reading.pressure >= 10 ? '#ff3b30' : '#00d4aa' }}>
                      {reading.pressure.toFixed(2)} MPa
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const WorkLogContent: React.FC<{ log: WorkLog } & ContentProps> = ({
  log,
  highlightLine,
}) => {
  const latestVersion = log.versions[log.versions.length - 1];
  const lines = latestVersion?.content.split('\n') || [];

  return (
    <div className="space-y-4">
      <div className="p-3 bg-industrial-bg rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="px-2 py-1 bg-data-purple/20 text-data-purple text-xs font-medium rounded">
            设备 {log.equipmentId}
          </span>
          <span className="text-xs text-industrial-text-muted">
            当前版本 v{log.currentVersion}
          </span>
        </div>

        <div className="text-sm text-industrial-text-muted">
          历史版本: {log.versions.length} 个
        </div>
      </div>

      {log.versions.length > 1 && (
        <div>
          <h4 className="text-sm font-medium text-industrial-text mb-2">版本历史</h4>
          <div className="space-y-1">
            {[...log.versions].reverse().map((version, idx) => (
              <div
                key={version.id}
                className="flex items-center justify-between px-3 py-2 bg-industrial-bg rounded text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-tech-blue">v{version.version}</span>
                  <span className="text-industrial-text-muted">
                    {version.uploadSource === 'original' ? '原始上传' : '补传'}
                  </span>
                </div>
                <span className="text-xs text-industrial-text-dim">
                  {formatDateTime(version.uploadedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-sm font-medium text-industrial-text mb-2">
          日志内容 (v{latestVersion?.version})
        </h4>
        <div className="bg-industrial-bg rounded-lg overflow-hidden">
          <div className="max-h-80 overflow-y-auto">
            {lines.map((line, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex px-3 py-1 text-sm font-mono',
                  highlightLine === idx + 1
                    ? 'bg-tech-blue/30 text-white'
                    : idx % 2 === 0
                    ? 'bg-industrial-bg'
                    : 'bg-industrial-bg-light'
                )}
              >
                <span className="w-10 text-right text-industrial-text-dim mr-3 select-none">
                  {idx + 1}
                </span>
                <span className="flex-1 text-industrial-text">{line}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const MaintenanceContent: React.FC<{ order: MaintenanceOrder }> = ({ order }) => {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-industrial-bg rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-tech-blue">{order.orderNo}</span>
          <StatusBadge type="maintenance" status={order.status} />
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-industrial-text-muted">
            <Wrench className="w-4 h-4" />
            <span>设备: {order.equipment}</span>
          </div>
          <div className="flex items-center gap-2 text-industrial-text-muted">
            <User className="w-4 h-4" />
            <span>维修人员: {order.technician}</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-industrial-text mb-2">故障描述</h4>
        <div className="p-3 bg-industrial-bg rounded-lg text-sm text-industrial-text whitespace-pre-wrap">
          {order.faultDescription}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-industrial-text mb-2">维修内容</h4>
        <div className="p-3 bg-industrial-bg rounded-lg text-sm text-industrial-text whitespace-pre-wrap">
          {order.maintenanceContent}
        </div>
      </div>

      {order.partsReplaced && (
        <div>
          <h4 className="text-sm font-medium text-industrial-text mb-2">更换部件</h4>
          <div className="p-3 bg-industrial-bg rounded-lg text-sm text-industrial-text whitespace-pre-wrap">
            {order.partsReplaced}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-industrial-bg rounded-lg">
          <p className="text-xs text-industrial-text-muted mb-1">开始时间</p>
          <p className="text-sm font-mono">{formatDateTime(order.startTime)}</p>
        </div>
        <div className="p-3 bg-industrial-bg rounded-lg">
          <p className="text-xs text-industrial-text-muted mb-1">结束时间</p>
          <p className="text-sm font-mono">
            {order.endTime ? formatDateTime(order.endTime) : '进行中'}
          </p>
        </div>
      </div>
    </div>
  );
};

interface EmptyStateProps {
  type: SourceType;
}

const EmptyState: React.FC<EmptyStateProps> = ({ type }) => {
  const Icon = SourceIcon[type];
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <Icon className="w-12 h-12 text-industrial-text-dim mb-3" />
      <p className="text-industrial-text-muted">
        点击结论点查看对应{SOURCE_TYPE_LABELS[type]}
      </p>
    </div>
  );
};
