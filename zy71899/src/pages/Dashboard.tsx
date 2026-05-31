import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Gauge,
  TrendingUp,
  Clock,
  FileText,
  ClipboardList,
  Wrench,
  Play,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useRecordsStore } from '@/stores/recordsStore';
import { useUIStore } from '@/stores/uiStore';
import { PressureWaveform } from '@/components/PressureWaveform';
import { StatusBadge, StatusIndicator } from '@/components/StatusBadge';
import { formatDateTime, formatTime } from '@/utils/helpers';
import { THRESHOLDS } from '@/types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { analysisRuns, batches, loadBatches, loadAnalysisRuns, loading, error } = useAnalysisStore();
  const { shiftRecords, workLogs, maintenanceOrders, notifications, loadShiftRecords, loadWorkLogs, loadMaintenanceOrders, loadNotifications } = useRecordsStore();
  const { currentUser, setShowNotificationPanel } = useUIStore();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  useEffect(() => {
    loadBatches();
    loadShiftRecords();
    loadWorkLogs();
    loadMaintenanceOrders();
    loadNotifications();
  }, []);

  useEffect(() => {
    if (batches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches]);

  useEffect(() => {
    if (selectedBatchId) {
      loadAnalysisRuns(selectedBatchId);
    }
  }, [selectedBatchId]);

  const latestAnalysis = analysisRuns[0];
  const latestWaveformData = latestAnalysis?.waveformData || [];
  const latestConclusions = latestAnalysis?.conclusions || [];

  const dangerCount = latestConclusions.filter((c) => c.thresholdLevel === 'danger').length;
  const warningCount = latestConclusions.filter((c) => c.thresholdLevel === 'warning').length;

  const stats = [
    {
      label: '班组记录',
      value: shiftRecords.length,
      icon: FileText,
      color: 'tech-blue',
      path: '/records/shift',
    },
    {
      label: '工况日志',
      value: workLogs.length,
      icon: ClipboardList,
      color: 'data-purple',
      path: '/records/logs',
    },
    {
      label: '维修工单',
      value: maintenanceOrders.filter((o) => o.status !== 'completed').length,
      icon: Wrench,
      color: 'alert-orange',
      path: '/records/maintenance',
    },
    {
      label: '分析次数',
      value: analysisRuns.length,
      icon: Activity,
      color: 'signal-green',
      path: '/pulse-analysis',
    },
  ];

  const recentBatches = batches.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-industrial-text">数据看板</h1>
          <p className="text-industrial-text-muted mt-1">
            欢迎回来，{currentUser?.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {notifications.length > 0 && (
            <button
              onClick={() => setShowNotificationPanel(true)}
              className="flex items-center gap-2 px-4 py-2 bg-alert-orange/20 text-alert-orange rounded-lg hover:bg-alert-orange/30 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{notifications.length} 条数据变更待确认</span>
            </button>
          )}
          <button
            onClick={() => navigate('/pulse-analysis')}
            className="btn-primary flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            新建分析
          </button>
        </div>
      </div>

      {notifications.length > 0 && (
        <div className="p-4 bg-alert-orange/10 border border-alert-orange/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-alert-orange flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-alert-orange font-medium">
                检测到 {notifications.length} 处工况日志数据变更
              </p>
              <p className="text-sm text-industrial-text-muted mt-1">
                部分变更影响已有分析结论，请及时查看并确认是否需要重新分析
              </p>
            </div>
            <button
              onClick={() => setShowNotificationPanel(true)}
              className="text-sm text-tech-blue hover:underline"
            >
              查看详情
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const colorClasses = {
            'tech-blue': 'bg-tech-blue/20 text-tech-blue',
            'data-purple': 'bg-data-purple/20 text-data-purple',
            'alert-orange': 'bg-alert-orange/20 text-alert-orange',
            'signal-green': 'bg-signal-green/20 text-signal-green',
          }[stat.color as keyof typeof colorClasses];

          return (
            <button
              key={stat.label}
              onClick={() => navigate(stat.path)}
              className="p-4 bg-industrial-bg-light border border-industrial-border rounded-lg hover:border-tech-blue/50 transition-all group text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${colorClasses}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-industrial-text-dim group-hover:text-tech-blue transition-colors" />
              </div>
              <p className="text-2xl font-bold text-industrial-text">{stat.value}</p>
              <p className="text-sm text-industrial-text-muted">{stat.label}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-industrial-text">压力脉冲波形</h2>
              {latestAnalysis && (
                <p className="text-sm text-industrial-text-muted">
                  v{latestAnalysis.version} · {formatDateTime(latestAnalysis.analysisTime)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <StatusIndicator active color={dangerCount > 0 ? 'red' : 'green'} />
                <span className="text-sm text-industrial-text-muted">
                  {dangerCount > 0 ? `${dangerCount} 处危险` : '运行正常'}
                </span>
              </div>
              <StatusBadge
                type="threshold"
                level={dangerCount > 0 ? 'danger' : warningCount > 0 ? 'warning' : 'normal'}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-80">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tech-blue" />
            </div>
          ) : latestWaveformData.length > 0 ? (
            <PressureWaveform
              data={latestWaveformData}
              conclusions={latestConclusions}
              height={320}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-80 text-center">
              <Gauge className="w-12 h-12 text-industrial-text-dim mb-3" />
              <p className="text-industrial-text-muted mb-2">暂无分析数据</p>
              <button
                onClick={() => navigate('/pulse-analysis')}
                className="btn-primary text-sm"
              >
                开始第一次分析
              </button>
            </div>
          )}

          {latestConclusions.length > 0 && (
            <div className="mt-4 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-danger-red" />
                <span className="text-sm text-industrial-text-muted">
                  危险跨档: <span className="font-bold text-danger-red">{dangerCount}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-alert-orange" />
                <span className="text-sm text-industrial-text-muted">
                  警戒跨档: <span className="font-bold text-alert-orange">{warningCount}</span>
                </span>
              </div>
              <div className="flex-1" />
              <button
                onClick={() => navigate('/pulse-analysis')}
                className="text-sm text-tech-blue hover:underline flex items-center gap-1"
              >
                查看详细分析
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
          <h2 className="text-lg font-semibold text-industrial-text mb-4">最近批次</h2>

          {recentBatches.length === 0 ? (
            <div className="text-center py-8 text-industrial-text-muted">
              暂无批次数据
            </div>
          ) : (
            <div className="space-y-3">
              {recentBatches.map((batch) => (
                <button
                  key={batch.id}
                  onClick={() => {
                    setSelectedBatchId(batch.id);
                    navigate('/pulse-analysis', { state: { batchId: batch.id } });
                  }}
                  className="w-full p-3 bg-industrial-bg rounded-lg hover:bg-industrial-bg-lighter transition-colors text-left"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-tech-blue">
                      {batch.material?.batchNo}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded ${
                        batch.status === 'active'
                          ? 'bg-signal-green/20 text-signal-green'
                          : batch.status === 'completed'
                          ? 'bg-tech-blue/20 text-tech-blue'
                          : 'bg-industrial-text-dim/20 text-industrial-text-muted'
                      }`}
                    >
                      {batch.status === 'active' ? '进行中' : batch.status === 'completed' ? '已完成' : '已归档'}
                    </span>
                  </div>
                  <p className="text-sm text-industrial-text">
                    {batch.material?.name}
                  </p>
                  <p className="text-xs text-industrial-text-muted">
                    {batch.material?.spec}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-industrial-text">最近班组记录</h2>
            <button
              onClick={() => navigate('/records/shift')}
              className="text-sm text-tech-blue hover:underline"
            >
              查看全部
            </button>
          </div>

          {shiftRecords.slice(0, 3).map((record) => (
            <div
              key={record.id}
              className="p-3 bg-industrial-bg rounded-lg mb-3 last:mb-0"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-tech-blue/20 text-tech-blue text-xs rounded">
                    {record.shift === 'day' ? '白班' : '夜班'}
                  </span>
                  <span className="text-sm text-industrial-text-muted">
                    {record.operator}
                  </span>
                </div>
                <span className="text-xs text-industrial-text-dim">
                  {formatTime(record.recordTime)}
                </span>
              </div>
              <p className="text-sm text-industrial-text line-clamp-1">
                {record.content}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-industrial-text">阈值配置</h2>
          </div>

          <div className="space-y-3">
            {THRESHOLDS.map((threshold) => (
              <div
                key={threshold.level}
                className="flex items-center justify-between p-3 bg-industrial-bg rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: threshold.color }}
                  />
                  <span className="text-industrial-text">
                    {threshold.level === 'normal' ? '正常' : threshold.level === 'warning' ? '警戒' : '危险'}
                  </span>
                </div>
                <span className="font-mono text-industrial-text">
                  {threshold.min.toFixed(1)} - {threshold.max.toFixed(1)} MPa
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-industrial-bg rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-industrial-text-muted" />
              <span className="text-sm text-industrial-text-muted">判定规则</span>
            </div>
            <p className="text-xs text-industrial-text-muted">
              连续 3 个采样点超过阈值即标记为阈值跨档。警戒阈值 8.0 MPa，危险阈值 10.0 MPa。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
