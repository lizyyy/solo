import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Thermometer,
  Gauge,
  Zap,
  Clock,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { DataCard } from '@/components/common/DataCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { AnomalyTable } from '@/components/tables/AnomalyTable';
import { HistoryTable } from '@/components/tables/HistoryTable';
import { useAppStore } from '@/store/useAppStore';
import { formatTemperature, formatTorque, formatSpeed } from '@/utils/formatters';
import { runAnalysisForDevice } from '@/services/analysisService';
import { generateReport } from '@/services/reportService';
import type { ReportConfig } from '@/types';
import { Modal } from '@/components/common/Modal';
import { AlignedSample } from '@/types';

const Dashboard: React.FC = () => {
  const {
    currentDeviceId,
    alignedSamples,
    segments,
    anomalies,
    history,
    anomalyCounts,
    isLoading,
    loadDashboardData,
    refreshData,
    setAlignedSamples,
    setSegments,
    setAnomalies,
  } = useAppStore();

  const [sampleDetail, setSampleDetail] = useState<AlignedSample | null>(null);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleRunAnalysis = async () => {
    setAnalysisRunning(true);
    try {
      const result = await runAnalysisForDevice(currentDeviceId, {});
      setAlignedSamples(result.alignedSamples);
      setSegments(result.segments);
      setAnomalies(result.anomalies);
      await refreshData();
    } catch (error) {
      console.error('分析失败:', error);
    } finally {
      setAnalysisRunning(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportGenerating(true);
    try {
      const now = Date.now();
      const config: ReportConfig = {
        title: `电机扭矩分析报告_${currentDeviceId}`,
        deviceId: currentDeviceId,
        startTime: now - 2 * 60 * 60 * 1000,
        endTime: now,
        includeSegments: true,
        includeAnomalies: true,
        includeRawData: true,
        includeCharts: true,
        generatedBy: useAppStore.getState().currentUser,
      };
      await generateReport(config);
      await refreshData();
    } catch (error) {
      console.error('生成报告失败:', error);
    } finally {
      setReportGenerating(false);
    }
  };

  const latestSample = alignedSamples[alignedSamples.length - 1];
  const avgTorque = alignedSamples.length > 0
    ? alignedSamples.reduce((sum, s) => sum + s.torque, 0) / alignedSamples.length
    : 0;
  const maxTemp = alignedSamples.length > 0
    ? Math.max(...alignedSamples.map(s => s.temperature))
    : 0;
  const avgSpeed = alignedSamples.length > 0
    ? alignedSamples.reduce((sum, s) => sum + s.speed, 0) / alignedSamples.length
    : 0;

  const pendingAnomalies = anomalies.filter(a => a.status === 'detected').length;
  const confirmedAnomalies = anomalies.filter(a => a.status === 'confirmed').length;
  const resolvedAnomalies = anomalies.filter(a => a.status === 'resolved').length;

  return (
    <MainLayout onRefresh={refreshData} onImport={handleRunAnalysis} onExport={handleGenerateReport}>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">工作台</h1>
            <p className="text-sm text-slate-400 mt-1">
              设备 {currentDeviceId} · 实时监控与数据分析
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-sm border border-slate-700">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-slow" />
              <span className="text-sm text-slate-300">系统正常</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <DataCard
            title="当前扭矩"
            value={latestSample ? latestSample.torque.toFixed(1) : '--'}
            unit="N·m"
            subtitle={formatTorque(avgTorque) + ' (平均)'}
            icon={<Zap size={18} />}
            trend={{ value: 2.3, isPositive: true }}
            highlight={true}
          />
          <DataCard
            title="当前转速"
            value={latestSample ? Math.round(latestSample.speed).toString() : '--'}
            unit="rpm"
            subtitle={formatSpeed(avgSpeed) + ' (平均)'}
            icon={<Gauge size={18} />}
            trend={{ value: 0.8, isPositive: true }}
          />
          <DataCard
            title="最高温度"
            value={maxTemp.toFixed(1)}
            unit="°C"
            subtitle={latestSample ? formatTemperature(latestSample.temperature) + ' (当前)' : '--'}
            icon={<Thermometer size={18} />}
            trend={{ value: 5.2, isPositive: false }}
            highlight={maxTemp > 130}
          />
          <DataCard
            title="待处理异常"
            value={pendingAnomalies.toString()}
            unit="个"
            subtitle={`已确认 ${confirmedAnomalies} · 已解决 ${resolvedAnomalies}`}
            icon={<AlertTriangle size={18} />}
            highlight={pendingAnomalies > 0}
          />
        </div>

        <div className="grid grid-cols-4 gap-4">
          <DataCard
            title="采样总数"
            value={alignedSamples.length.toString()}
            unit="条"
            icon={<Activity size={18} />}
          />
          <DataCard
            title="工况段数"
            value={segments.length.toString()}
            unit="段"
            icon={<Clock size={18} />}
          />
          <DataCard
            title="异常总数"
            value={anomalies.length.toString()}
            unit="个"
            icon={<AlertTriangle size={18} />}
          />
          <DataCard
            title="分析报告"
            value={anomalyCounts.total.toString()}
            unit="份"
            icon={<FileText size={18} />}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">异常类型分布</div>
            <div className="space-y-3">
              {Object.entries(anomalyCounts.byType).map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <StatusBadge type="anomalyType" value={type} />
                  <div className="flex-1 h-2 bg-slate-700 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-sm transition-all duration-500"
                      style={{
                        width: `${anomalyCounts.total > 0 ? (count / anomalyCounts.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-400 w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">严重程度分布</div>
            <div className="space-y-3">
              {Object.entries(anomalyCounts.bySeverity).map(([severity, count]) => (
                <div key={severity} className="flex items-center gap-3">
                  <StatusBadge type="severity" value={severity} />
                  <div className="flex-1 h-2 bg-slate-700 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-sm transition-all duration-500"
                      style={{
                        width: `${anomalyCounts.total > 0 ? (count / anomalyCounts.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-400 w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">处理状态分布</div>
            <div className="space-y-3">
              {Object.entries(anomalyCounts.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center gap-3">
                  <StatusBadge type="status" value={status} />
                  <div className="flex-1 h-2 bg-slate-700 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-sm transition-all duration-500"
                      style={{
                        width: `${anomalyCounts.total > 0 ? (count / anomalyCounts.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-400 w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <AnomalyTable
            anomalies={anomalies.slice(0, 5)}
            onViewDetail={(anomaly) => console.log('查看异常详情:', anomaly)}
          />
          <HistoryTable history={history.slice(0, 10)} />
        </div>

        <Modal
          isOpen={!!sampleDetail}
          onClose={() => setSampleDetail(null)}
          title="采样数据详情"
          size="md"
        >
          {sampleDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">采样ID</div>
                  <div className="text-sm font-mono text-slate-200">{sampleDetail.id}</div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">原始采样ID</div>
                  <div className="text-sm font-mono text-slate-200">{sampleDetail.rawSampleId}</div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">时间戳</div>
                  <div className="text-sm font-mono text-slate-200">{sampleDetail.timestamp}</div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">对齐状态</div>
                  <StatusBadge type="alignment" value={sampleDetail.alignmentStatus} />
                </div>
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">转速</div>
                  <div className="text-sm font-mono text-blue-400">{formatSpeed(sampleDetail.speed)}</div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">扭矩</div>
                  <div className="text-sm font-mono text-emerald-400">{formatTorque(sampleDetail.torque)}</div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">温度</div>
                  <div className="text-sm font-mono text-red-400">{formatTemperature(sampleDetail.temperature)}</div>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">负载档</div>
                  <div className="text-sm font-mono text-amber-400">{sampleDetail.loadLevel} 档</div>
                </div>
              </div>
              {sampleDetail.anomalyIds.length > 0 && (
                <div className="bg-slate-900/50 p-3 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-2">关联异常</div>
                  <div className="flex flex-wrap gap-2">
                    {sampleDetail.anomalyIds.map((id) => (
                      <span key={id} className="text-xs font-mono text-red-400 bg-red-500/10 px-2 py-1 rounded-sm">
                        {id.slice(-8)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {analysisRunning && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="card p-6 text-center">
              <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <div className="text-sm text-slate-300">正在执行数据分析...</div>
              <div className="text-xs text-slate-500 mt-2">扭矩计算 · 曲线对齐 · 工况分段 · 异常检测</div>
            </div>
          </div>
        )}

        {reportGenerating && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="card p-6 text-center">
              <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <div className="text-sm text-slate-300">正在生成分析报告...</div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Dashboard;
