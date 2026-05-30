import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { AnomalyTable } from '@/components/tables/AnomalyTable';
import { StatusBadge } from '@/components/common/StatusBadge';
import { DataCard } from '@/components/common/DataCard';
import { Modal } from '@/components/common/Modal';
import { useAppStore } from '@/store/useAppStore';
import { Anomaly } from '@/types/anomalies';
import { formatTime, formatDuration } from '@/utils/formatters';
import { AlertTriangle, Clock, CheckCircle, XCircle, Filter, Download } from 'lucide-react';
import { exportToCSV } from '@/utils/exporters';

const Anomalies: React.FC = () => {
  const { anomalies, loadDashboardData, currentDeviceId } = useAppStore();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const viewDetail = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
    setDetailModalOpen(true);
  };

  const filteredAnomalies = anomalies.filter((a) => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    return true;
  });

  const detectedCount = anomalies.filter(a => a.status === 'detected').length;
  const confirmedCount = anomalies.filter(a => a.status === 'confirmed').length;
  const resolvedCount = anomalies.filter(a => a.status === 'resolved').length;
  const dismissedCount = anomalies.filter(a => a.status === 'dismissed').length;

  const handleExport = () => {
    const exportData = filteredAnomalies.map(a => ({
      ID: a.id,
      类型: a.type,
      严重程度: a.severity,
      状态: a.status,
      描述: a.description,
      检测时间: formatTime(a.detectedAt),
      影响采样数: a.affectedSampleIds.length,
      处理人: a.confirmedBy || '',
      处理时间: a.confirmedAt ? formatTime(a.confirmedAt) : '',
      处理备注: a.confirmedNote || '',
    }));
    exportToCSV(exportData, `anomalies_${currentDeviceId}_${Date.now()}.csv`);
  };

  const renderAnomalyDetail = (anomaly: Anomaly) => {
    const detailItems: Array<{ label: string; value: React.ReactNode }> = [];

    if (anomaly.type === 'sampling_shift') {
      detailItems.push(
        { label: '偏移量', value: <span className="text-purple-400 font-mono">+{anomaly.detail.shiftOffset} ms</span> },
        { label: '置信度', value: <span className="font-mono">{((anomaly.detail.shiftConfidence || 0) * 100).toFixed(1)}%</span> }
      );
    } else if (anomaly.type === 'temp_over_limit') {
      detailItems.push(
        { label: '最高温度', value: <span className="text-red-400 font-mono">{anomaly.detail.tempValue} °C</span> },
        { label: '报警阈值', value: <span className="font-mono">{anomaly.detail.tempLimit} °C</span> },
        { label: '持续时间', value: <span className="font-mono">{formatDuration(anomaly.detail.tempDuration || 0)}</span> },
        { label: '升温速率', value: <span className="font-mono">{anomaly.detail.tempRiseRate?.toFixed(2)} °C/min</span> }
      );
    } else if (anomaly.type === 'missing_load') {
      detailItems.push(
        { label: '缺失范围', value: <span className="font-mono">{formatTime(anomaly.detail.missingLoadRange?.[0] || 0)} - {formatTime(anomaly.detail.missingLoadRange?.[1] || 0)}</span> },
        { label: '推断负载', value: <span className="text-amber-400 font-mono">{anomaly.detail.inferredLoadLevel} 档</span> },
        { label: '推断置信度', value: <span className="font-mono">{((anomaly.detail.inferenceConfidence || 0) * 100).toFixed(1)}%</span> }
      );
    } else if (anomaly.type === 'duplicate_data') {
      detailItems.push(
        { label: '重复批次', value: <span className="font-mono text-slate-400">{anomaly.detail.duplicateBatchIds?.join(', ')}</span> }
      );
    } else if (anomaly.type === 'supplement_data') {
      detailItems.push(
        { label: '补录批次', value: <span className="font-mono text-cyan-400">{anomaly.detail.supplementBatchId}</span> }
      );
    }

    return detailItems;
  };

  return (
    <MainLayout onRefresh={loadDashboardData} onExport={handleExport}>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">异常管理</h1>
            <p className="text-sm text-slate-400 mt-1">
              业务例外处理 · 采样错位 / 温升超限 / 负载档漏记
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost flex items-center gap-2 py-1.5"
              onClick={handleExport}
            >
              <Download size={16} />
              <span>导出异常列表</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <DataCard
            title="待处理"
            value={detectedCount.toString()}
            unit="个"
            icon={<AlertTriangle size={18} />}
            highlight={detectedCount > 0}
          />
          <DataCard
            title="已确认"
            value={confirmedCount.toString()}
            unit="个"
            icon={<Clock size={18} />}
          />
          <DataCard
            title="已解决"
            value={resolvedCount.toString()}
            unit="个"
            icon={<CheckCircle size={18} />}
          />
          <DataCard
            title="已忽略"
            value={dismissedCount.toString()}
            unit="个"
            icon={<XCircle size={18} />}
          />
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <span className="text-sm text-slate-400">筛选:</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">状态</span>
              <select
                className="input py-1.5 text-sm w-32"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">全部状态</option>
                <option value="detected">待处理</option>
                <option value="confirmed">已确认</option>
                <option value="resolved">已解决</option>
                <option value="dismissed">已忽略</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">类型</span>
              <select
                className="input py-1.5 text-sm w-32"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">全部类型</option>
                <option value="sampling_shift">采样错位</option>
                <option value="temp_over_limit">温升超限</option>
                <option value="missing_load">负载档漏记</option>
                <option value="duplicate_data">重复数据</option>
                <option value="supplement_data">补录数据</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">严重程度</span>
              <select
                className="input py-1.5 text-sm w-32"
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
              >
                <option value="all">全部</option>
                <option value="warning">预警</option>
                <option value="error">异常</option>
                <option value="critical">严重</option>
              </select>
            </div>

            <span className="text-xs text-slate-500 ml-auto">
              显示 {filteredAnomalies.length} / {anomalies.length} 条记录
            </span>
          </div>
        </div>

        <AnomalyTable
          anomalies={filteredAnomalies}
          onViewDetail={viewDetail}
        />

        <Modal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title="异常事件详情"
          size="lg"
        >
          {selectedAnomaly && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <StatusBadge type="anomalyType" value={selectedAnomaly.type} />
                <StatusBadge type="severity" value={selectedAnomaly.severity} />
                <StatusBadge type="status" value={selectedAnomaly.status} />
              </div>

              <div className="bg-slate-900/50 p-4 rounded-sm border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">异常描述</div>
                <p className="text-sm text-slate-200">{selectedAnomaly.description}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">检测时间</div>
                  <div className="text-sm font-mono text-slate-200">
                    {formatTime(selectedAnomaly.detectedAt)}
                  </div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">影响采样数</div>
                  <div className="text-lg font-mono text-slate-200">
                    {selectedAnomaly.affectedSampleIds.length}
                  </div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">影响工况段</div>
                  <div className="text-lg font-mono text-slate-200">
                    {selectedAnomaly.affectedSegmentIds.length}
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-sm border border-slate-700">
                <div className="text-xs text-slate-400 mb-3">异常详细参数</div>
                <div className="grid grid-cols-2 gap-4">
                  {renderAnomalyDetail(selectedAnomaly).map((item, idx) => (
                    <div key={idx}>
                      <div className="text-xs text-slate-500 mb-1">{item.label}</div>
                      <div className="text-sm">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedAnomaly.correctedData && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-sm">
                  <div className="text-xs text-emerald-400 mb-3">✅ 已应用修正数据</div>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedAnomaly.correctedData.torque !== undefined && (
                      <div>
                        <div className="text-xs text-slate-500 mb-1">修正后扭矩</div>
                        <div className="text-sm font-mono text-emerald-400">
                          {selectedAnomaly.correctedData.torque.toFixed(2)} N·m
                        </div>
                      </div>
                    )}
                    {selectedAnomaly.correctedData.loadLevel !== undefined && (
                      <div>
                        <div className="text-xs text-slate-500 mb-1">修正后负载档</div>
                        <div className="text-sm font-mono text-emerald-400">
                          {selectedAnomaly.correctedData.loadLevel} 档
                        </div>
                      </div>
                    )}
                    {selectedAnomaly.correctedData.shiftOffset !== undefined && (
                      <div>
                        <div className="text-xs text-slate-500 mb-1">时间偏移修正</div>
                        <div className="text-sm font-mono text-emerald-400">
                          {selectedAnomaly.correctedData.shiftOffset} ms
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedAnomaly.confirmedBy && (
                <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-sm">
                  <div className="text-xs text-blue-400 mb-2">处理记录</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">处理人</div>
                      <div className="text-sm text-slate-200">{selectedAnomaly.confirmedBy}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">处理时间</div>
                      <div className="text-sm font-mono text-slate-200">
                        {selectedAnomaly.confirmedAt ? formatTime(selectedAnomaly.confirmedAt) : '-'}
                      </div>
                    </div>
                  </div>
                  {selectedAnomaly.confirmedNote && (
                    <div className="mt-3">
                      <div className="text-xs text-slate-500 mb-1">处理备注</div>
                      <div className="text-sm text-slate-300 bg-slate-900/50 p-2 rounded-sm">
                        {selectedAnomaly.confirmedNote}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="btn btn-ghost"
                  onClick={() => setDetailModalOpen(false)}
                >
                  关闭
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    useAppStore.getState().highlightAnomaly(selectedAnomaly.id!);
                    setDetailModalOpen(false);
                    window.location.href = '/analysis';
                  }}
                >
                  在图表中定位
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </MainLayout>
  );
};

export default Anomalies;
