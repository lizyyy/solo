import { useState } from 'react';
import {
  Clock,
  CheckCircle,
  Upload,
  Edit,
  AlertTriangle,
  MapPin,
  Waves,
  ChevronDown,
  ChevronRight,
  User,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime } from '../utils/anomalyUtils';
import type { ChangeAction, ChangeSourceType } from '../types';

const AuditPage = () => {
  const {
    changeLogs,
    buoyLogs,
    spatialMarks,
    anomalies,
    resetToMockData,
    setSelectedLogId,
    setShowLogDetail,
    setSelectedMarkId,
  } = useAppStore();

  const [filterSource, setFilterSource] = useState<ChangeSourceType | 'all'>('all');
  const [filterAction, setFilterAction] = useState<ChangeAction | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const filteredLogs = changeLogs.filter((log) => {
    if (filterSource !== 'all' && log.sourceType !== filterSource) return false;
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    return true;
  });

  const getActionIcon = (action: ChangeAction) => {
    switch (action) {
      case 'confirm':
        return <CheckCircle className="w-4 h-4 text-seagrass-500" />;
      case 'import':
        return <Upload className="w-4 h-4 text-ocean-500" />;
      case 'resolve':
        return <CheckCircle className="w-4 h-4 text-seagrass-500" />;
      case 'create':
        return <MapPin className="w-4 h-4 text-ocean-500" />;
      case 'update':
        return <Edit className="w-4 h-4 text-sand-500" />;
      case 'supplement':
        return <FileText className="w-4 h-4 text-ocean-500" />;
      case 'mark_abnormal':
        return <AlertTriangle className="w-4 h-4 text-coral-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActionLabel = (action: ChangeAction) => {
    const labels: Record<ChangeAction, string> = {
      confirm: '人工确认',
      import: '批量导入',
      resolve: '异常处理',
      create: '新增记录',
      update: '更新记录',
      supplement: '补录材料',
      mark_abnormal: '标记异常',
    };
    return labels[action] || action;
  };

  const getSourceLabel = (type: ChangeSourceType) => {
    const labels: Record<ChangeSourceType, string> = {
      buoy_log: '浮标日志',
      spatial_mark: '空间标注',
      anomaly: '异常记录',
    };
    return labels[type] || type;
  };

  const getSourceName = (log: typeof changeLogs[0]) => {
    if (log.sourceType === 'buoy_log') {
      const buoy = buoyLogs.find((b) => b.id === log.sourceId);
      return buoy?.buoyId || log.sourceId;
    }
    if (log.sourceType === 'spatial_mark') {
      const mark = spatialMarks.find((m) => m.id === log.sourceId);
      return mark?.name || log.sourceId;
    }
    if (log.sourceType === 'anomaly') {
      const anomaly = anomalies.find((a) => a.id === log.sourceId);
      return anomaly ? `异常-${anomaly.type}` : log.sourceId;
    }
    return log.sourceId;
  };

  const getSourceIcon = (type: ChangeSourceType) => {
    switch (type) {
      case 'buoy_log':
        return <Waves className="w-3.5 h-3.5" />;
      case 'spatial_mark':
        return <MapPin className="w-3.5 h-3.5" />;
      case 'anomaly':
        return <AlertTriangle className="w-3.5 h-3.5" />;
      default:
        return <FileText className="w-3.5 h-3.5" />;
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getFieldLabel = (key: string): string => {
    const labels: Record<string, string> = {
      isConfirmed: '确认状态',
      remark: '备注',
      confirmer: '确认人',
      status: '状态',
      name: '名称',
      isResolved: '处理状态',
      resolvedRemark: '处理说明',
      resolvedBy: '处理人',
      seagrassCoverage: '海草覆盖度',
      biomass: '生物量',
      temperature: '水温',
      longitude: '经度',
      latitude: '纬度',
    };
    return labels[key] || key;
  };

  const formatValue = (key: string, value: any): string => {
    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }
    if (value === null || value === undefined) {
      return '-';
    }
    if (key === 'isConfirmed') {
      return value ? '已确认' : '待确认';
    }
    if (key === 'isResolved') {
      return value ? '已处理' : '待处理';
    }
    if (key === 'status') {
      return value === 'abnormal' ? '异常' : '正常';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    return String(value);
  };

  const getChangedFields = (log: typeof changeLogs[0]) => {
    const before = log.beforeData || {};
    const after = log.afterData || {};
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const changed: { key: string; before: any; after: any }[] = [];

    allKeys.forEach((key) => {
      const beforeVal = before[key];
      const afterVal = after[key];
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        changed.push({ key, before: beforeVal, after: afterVal });
      }
    });

    return changed;
  };

  const handleViewSource = (log: typeof changeLogs[0]) => {
    if (log.sourceType === 'buoy_log') {
      setSelectedLogId(log.sourceId);
      setShowLogDetail(true);
    } else if (log.sourceType === 'spatial_mark') {
      setSelectedMarkId(log.sourceId);
    }
  };

  const handleReset = () => {
    resetToMockData();
    setShowResetConfirm(false);
  };

  const groupedByDate = filteredLogs.reduce((groups, log) => {
    const date = formatDateTime(log.createdAt).split(' ')[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(log);
    return groups;
  }, {} as Record<string, typeof changeLogs>);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ocean-900">变更审计</h2>
          <p className="text-ocean-600 mt-1 text-sm">查看所有数据变更记录和操作历史</p>
        </div>
        <button
          onClick={() => setShowResetConfirm(true)}
          className="px-4 py-2 text-sand-700 bg-sand-50 border border-sand-200 rounded-lg text-sm font-medium hover:bg-sand-100 transition-colors flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          重置数据
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">数据来源</h3>
            <div className="space-y-2">
              {(['all', 'buoy_log', 'spatial_mark', 'anomaly'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterSource(type)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    filterSource === type
                      ? 'bg-ocean-50 text-ocean-700 font-medium'
                      : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {type !== 'all' && getSourceIcon(type)}
                  <span>{type === 'all' ? '全部来源' : getSourceLabel(type)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-800 mb-3">操作类型</h3>
            <div className="space-y-2">
              {(['all', 'create', 'update', 'supplement', 'confirm', 'import', 'resolve'] as const).map(
                (action) => (
                  <button
                    key={action}
                    onClick={() => setFilterAction(action)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      filterAction === action
                        ? 'bg-ocean-50 text-ocean-700 font-medium'
                        : 'hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    {action !== 'all' && getActionIcon(action)}
                    <span>{action === 'all' ? '全部操作' : getActionLabel(action)}</span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-ocean-50 to-seagrass-50 rounded-xl p-4 border border-ocean-100">
            <h3 className="font-semibold text-ocean-900 mb-2 text-sm">变更统计</h3>
            <div className="text-3xl font-bold text-ocean-700">{filteredLogs.length}</div>
            <p className="text-xs text-ocean-600 mt-1">条变更记录</p>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-ocean-50 to-white">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-ocean-600" />
                <h3 className="font-semibold text-gray-800">操作时间线</h3>
              </div>
            </div>

            <div className="p-4 max-h-[600px] overflow-y-auto">
              {Object.entries(groupedByDate).map(([date, logs]) => (
                <div key={date} className="mb-6 last:mb-0">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                      {date}
                    </span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>

                  <div className="relative pl-6">
                    <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-ocean-300 via-seagrass-300 to-sand-300" />

                    {logs.map((log, index) => {
                      const isExpanded = expandedId === log.id;
                      const changedFields = getChangedFields(log);

                      return (
                        <div
                          key={log.id}
                          className="relative mb-4 last:mb-0 animate-fade-in-up"
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <div
                            className={`absolute -left-[22px] top-3 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                              log.action === 'confirm' || log.action === 'resolve'
                                ? 'bg-seagrass-500'
                                : log.action === 'create' || log.action === 'import'
                                ? 'bg-ocean-500'
                                : log.action === 'supplement'
                                ? 'bg-ocean-400'
                                : log.action === 'mark_abnormal'
                                ? 'bg-coral-500'
                                : 'bg-sand-500'
                            }`}
                          />

                          <div
                            onClick={() => toggleExpand(log.id)}
                            className={`bg-gray-50 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                              isExpanded ? 'ring-2 ring-ocean-200 bg-ocean-50/30' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                                  {getActionIcon(log.action)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-gray-800">
                                      {getActionLabel(log.action)}
                                    </h4>
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded ${
                                        log.sourceType === 'buoy_log'
                                          ? 'bg-ocean-100 text-ocean-700'
                                          : log.sourceType === 'spatial_mark'
                                          ? 'bg-seagrass-100 text-seagrass-700'
                                          : 'bg-coral-100 text-coral-700'
                                      }`}
                                    >
                                      {getSourceLabel(log.sourceType)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-500 mt-0.5">
                                    {getSourceName(log)}
                                  </p>
                                  {log.remark && (
                                    <p className="text-xs text-gray-400 mt-1">{log.remark}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-xs text-gray-400">
                                    {formatDateTime(log.createdAt).split(' ')[1]}
                                  </p>
                                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                    <User className="w-3 h-3" />
                                    {log.operator}
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                            </div>

                            {isExpanded && changedFields.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <p className="text-sm font-medium text-gray-700 mb-3">
                                  变更详情对比
                                </p>
                                <div className="space-y-2">
                                  {changedFields.map((field) => (
                                    <div
                                      key={field.key}
                                      className="bg-white rounded-lg p-3 border border-gray-100"
                                    >
                                      <p className="text-xs text-gray-500 mb-2 font-medium">
                                        {getFieldLabel(field.key)}
                                      </p>
                                      <div className="flex items-center gap-3">
                                        <div className="flex-1 bg-red-50 rounded p-2">
                                          <p className="text-xs text-red-500 mb-1">变更前</p>
                                          <p className="text-sm text-red-700 line-through">
                                            {formatValue(field.key, field.before)}
                                          </p>
                                        </div>
                                        <div className="text-gray-300">→</div>
                                        <div className="flex-1 bg-seagrass-50 rounded p-2">
                                          <p className="text-xs text-seagrass-600 mb-1">变更后</p>
                                          <p className="text-sm text-seagrass-700 font-medium">
                                            {formatValue(field.key, field.after)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewSource(log);
                                  }}
                                  className="mt-3 w-full py-2 bg-white border border-ocean-200 text-ocean-600 text-sm rounded-lg hover:bg-ocean-50 transition-colors"
                                >
                                  查看原始记录
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {filteredLogs.length === 0 && (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500">暂无变更记录</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showResetConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-50"
            onClick={() => setShowResetConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-fade-in-up">
            <div className="text-center">
              <div className="w-12 h-12 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <RotateCcw className="w-6 h-6 text-sand-600" />
              </div>
              <h3 className="font-bold text-lg text-gray-800">确认重置数据？</h3>
              <p className="text-sm text-gray-500 mt-2">
                重置后所有数据将恢复到初始示例状态，您的操作记录将被清除。
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 bg-sand-500 text-white rounded-lg font-medium hover:bg-sand-600 transition-colors"
              >
                确认重置
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditPage;
