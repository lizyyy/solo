import { useState } from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  User,
  FileCheck,
  Play,
} from 'lucide-react';
import { useHandoverStore } from '@/store/useHandoverStore';
import { HANDOVER_STATUS_LABELS, MATERIAL_TYPE_LABELS } from '@/types';
import { cn } from '@/lib/utils';

type TimelineFilter = 'all' | 'status' | 'material' | 'exception' | 'confirmation';

interface TimelineEvent {
  id: string;
  type: TimelineFilter;
  timestamp: string;
  title: string;
  description: string;
  operator?: string;
  status?: string;
}

export default function Timeline() {
  const [filter, setFilter] = useState<TimelineFilter>('all');

  const {
    getCurrentHandover,
    getMaterialsForHandover,
    getExceptionsForHandover,
    getStatusLogsForHandover,
    getConfirmationsForHandover,
  } = useHandoverStore();

  const currentHandover = getCurrentHandover();

  if (!currentHandover) {
    return (
      <div className="p-6">
        <div className="bg-white border border-gallery-200 rounded-lg p-12 text-center">
          <FileText className="w-16 h-16 mx-auto text-gallery-300 mb-4" />
          <h3 className="text-lg font-medium text-gallery-700 mb-2">请先选择交接单</h3>
          <p className="text-gallery-500">在交接工作台中选择或创建交接单</p>
        </div>
      </div>
    );
  }

  const materials = getMaterialsForHandover(currentHandover.id);
  const exceptions = getExceptionsForHandover(currentHandover.id);
  const statusLogs = getStatusLogsForHandover(currentHandover.id);
  const confirmations = getConfirmationsForHandover(currentHandover.id);

  const events: TimelineEvent[] = [
    ...statusLogs.map(log => ({
      id: `status-${log.id}`,
      type: 'status' as const,
      timestamp: log.createdAt,
      title: `状态变更`,
      description: `${log.fromStatus ? HANDOVER_STATUS_LABELS[log.fromStatus] : '初始'} → ${HANDOVER_STATUS_LABELS[log.toStatus]}`,
      operator: log.operator,
      status: log.toStatus,
    })),
    ...materials.map(material => ({
      id: `material-${material.id}`,
      type: 'material' as const,
      timestamp: material.createdAt,
      title: `材料上传`,
      description: `${MATERIAL_TYPE_LABELS[material.type]}: ${material.name}`,
      status: material.status,
    })),
    ...exceptions.map(exception => ({
      id: `exception-${exception.id}`,
      type: 'exception' as const,
      timestamp: exception.createdAt,
      title: `异常${exception.status === 'resolved' ? '已解决' : exception.status === 'ignored' ? '已忽略' : '触发'}`,
      description: exception.description,
      status: exception.status,
    })),
    ...confirmations.map(conf => ({
      id: `conf-${conf.id}`,
      type: 'confirmation' as const,
      timestamp: conf.confirmedAt,
      title: `人工确认`,
      description: `确认了 ${conf.relatedMaterialIds.length} 个材料${conf.remark ? `: ${conf.remark}` : ''}`,
      operator: conf.operator,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredEvents =
    filter === 'all' ? events : events.filter(e => e.type === filter);

  const getEventIcon = (type: TimelineEvent['type'], status?: string) => {
    switch (type) {
      case 'status':
        return <Play className="w-5 h-5" />;
      case 'material':
        return status === 'normal' ? (
          <CheckCircle className="w-5 h-5 text-accent-success" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-accent-warning" />
        );
      case 'exception':
        return status === 'resolved' ? (
          <CheckCircle className="w-5 h-5 text-accent-success" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-accent-danger" />
        );
      case 'confirmation':
        return <FileCheck className="w-5 h-5 text-accent-info" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const getEventColor = (type: TimelineEvent['type'], status?: string) => {
    switch (type) {
      case 'status':
        return 'bg-blue-100 border-blue-300 text-blue-700';
      case 'material':
        return status === 'normal'
          ? 'bg-green-100 border-green-300 text-green-700'
          : 'bg-amber-100 border-amber-300 text-amber-700';
      case 'exception':
        return status === 'resolved'
          ? 'bg-green-100 border-green-300 text-green-700'
          : status === 'ignored'
          ? 'bg-gallery-100 border-gallery-300 text-gallery-700'
          : 'bg-red-100 border-red-300 text-red-700';
      case 'confirmation':
        return 'bg-blue-100 border-blue-300 text-blue-700';
      default:
        return 'bg-gallery-100 border-gallery-300 text-gallery-700';
    }
  };

  const filters: { key: TimelineFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'status', label: '状态变更' },
    { key: 'material', label: '材料上传' },
    { key: 'exception', label: '异常记录' },
    { key: 'confirmation', label: '人工确认' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gallery-900">状态回看</h1>
        <p className="text-sm text-gallery-500 mt-1">查看交接单的完整操作历史和状态变更记录</p>
      </div>

      <div className="bg-white border border-gallery-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">交接单信息</h3>
          <span
            className={cn(
              'text-xs px-2 py-1 rounded',
              currentHandover.status === 'completed'
                ? 'bg-green-100 text-green-700'
                : currentHandover.status === 'processing'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gallery-100 text-gallery-600'
            )}
          >
            {HANDOVER_STATUS_LABELS[currentHandover.status]}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gallery-500">名称</div>
            <div className="font-medium">{currentHandover.title}</div>
          </div>
          <div>
            <div className="text-gallery-500">操作人</div>
            <div className="font-medium">{currentHandover.operator}</div>
          </div>
          <div>
            <div className="text-gallery-500">创建时间</div>
            <div className="font-medium">
              {new Date(currentHandover.createdAt).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-gallery-500">事件总数</div>
            <div className="font-medium">{events.length}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-4 py-2 rounded text-sm transition-colors',
              filter === f.key
                ? 'bg-gallery-900 text-white'
                : 'bg-gallery-100 text-gallery-600 hover:bg-gallery-200'
            )}
          >
            {f.label} ({events.filter(e => f.key === 'all' || e.type === f.key).length})
          </button>
        ))}
      </div>

      <div className="bg-white border border-gallery-200 rounded-lg p-6">
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gallery-200" />

          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 mx-auto text-gallery-300 mb-3" />
              <p className="text-gallery-500">暂无记录</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredEvents.map((event, index) => (
                <div key={event.id} className="relative pl-14">
                  <div
                    className={cn(
                      'absolute left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transform -translate-x-1/2',
                      getEventColor(event.type, event.status)
                    )}
                  >
                    <div className="w-2 h-2 rounded-full bg-current" />
                  </div>

                  <div className="bg-gallery-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getEventIcon(event.type, event.status)}
                        <span className="font-medium">{event.title}</span>
                      </div>
                      <span className="text-xs text-gallery-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-sm text-gallery-600">{event.description}</p>

                    {event.operator && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-gallery-500">
                        <User className="w-3 h-3" />
                        {event.operator}
                      </div>
                    )}
                  </div>

                  {index < filteredEvents.length - 1 && (
                    <div className="absolute left-6 top-8 w-px h-6 bg-gallery-200" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gallery-200 rounded-lg p-4">
        <h3 className="font-medium mb-3">当前状态流转</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {(['draft', 'processing', 'pending_confirm', 'completed'] as const).map((status, index, arr) => {
            const isPassed =
              statusLogs.some(l => l.toStatus === status) ||
              currentHandover.status === status ||
              arr.findIndex(s => s === currentHandover.status) >
                arr.findIndex(s => s === status);
            const isCurrent = currentHandover.status === status;

            return (
              <div key={status} className="flex items-center">
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded text-sm whitespace-nowrap',
                    isCurrent
                      ? 'bg-gallery-900 text-white'
                      : isPassed
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gallery-100 text-gallery-400'
                  )}
                >
                  {isPassed && !isCurrent && (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {HANDOVER_STATUS_LABELS[status]}
                </div>
                {index < arr.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-gallery-300 mx-2" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
