import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { DataCard } from '@/components/common/DataCard';
import { Modal } from '@/components/common/Modal';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useAppStore } from '@/store/useAppStore';
import { AnalysisReport, ReportConfig } from '@/types/report';
import { formatTimestamp, formatDuration, formatTorque, formatSpeed, formatTemperature } from '@/utils/formatters';
import { generateReport, exportReport } from '@/services/reportService';
import { FileText, Download, Plus, Eye, FileSpreadsheet, FileJson, File } from 'lucide-react';
import { exportToCSV, exportToJSON, exportToExcel } from '@/utils/exporters';

const Reports: React.FC = () => {
  const { reports, loadDashboardData, currentDeviceId, alignedSamples, segments, anomalies, setReports } = useAppStore();
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AnalysisReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'csv' | 'json'>('excel');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleGenerateReport = async () => {
    setGenerating(true);
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
      const report = await generateReport(config);
      if (report) {
        await useAppStore.getState().loadDashboardData();
      }
    } catch (error) {
      console.error('生成报告失败:', error);
    } finally {
      setGenerating(false);
    }
  };

  const viewDetail = (report: AnalysisReport) => {
    setSelectedReport(report);
    setDetailModalOpen(true);
  };

  const handleExport = async (report: AnalysisReport) => {
    setSelectedReport(report);
    setShowExportModal(true);
  };

  const executeExport = async () => {
    if (!selectedReport) return;
    setExporting(true);
    try {
      switch (exportFormat) {
        case 'csv':
          const csvData = [
            { '报告编号': selectedReport.id, '设备': selectedReport.deviceId, '生成时间': formatTimestamp(selectedReport.generatedAt) },
            {},
            { '统计摘要': '' },
            { '总采样数': selectedReport.summary.totalSamples },
            { '工况段数': selectedReport.summary.totalSegments },
            { '测试时长': formatDuration(selectedReport.summary.totalDuration) },
            { '平均扭矩': formatTorque(selectedReport.summary.avgTorque) },
            { '最大扭矩': formatTorque(selectedReport.summary.maxTorque) },
            { '平均转速': formatSpeed(selectedReport.summary.avgSpeed) },
            { '最高温度': formatTemperature(selectedReport.summary.maxTemperature) },
            {},
            { '异常统计': '' },
            { '异常总数': selectedReport.summary.anomalyCount },
            { '含异常工况段': selectedReport.summary.segmentsWithAnomaly },
          ];
          exportToCSV(csvData, `report_${selectedReport.id}_${Date.now()}.csv`);
          break;
        case 'json':
          exportToJSON(selectedReport, `report_${selectedReport.id}_${Date.now()}.json`);
          break;
        case 'excel':
          const excelData = {
            '报告信息': [
              { 字段: '报告编号', 值: selectedReport.id },
              { 字段: '设备编号', 值: selectedReport.deviceId },
              { 字段: '生成时间', 值: formatTimestamp(selectedReport.generatedAt) },
              { 字段: '分析人', 值: selectedReport.generatedBy },
            ],
            '统计摘要': [
              { 指标: '总采样数', 值: selectedReport.summary.totalSamples },
              { 指标: '工况段数', 值: selectedReport.summary.totalSegments },
              { 指标: '测试时长', 值: formatDuration(selectedReport.summary.totalDuration) },
              { 指标: '平均扭矩', 值: formatTorque(selectedReport.summary.avgTorque) },
              { 指标: '最大扭矩', 值: formatTorque(selectedReport.summary.maxTorque) },
              { 指标: '平均转速', 值: formatSpeed(selectedReport.summary.avgSpeed) },
              { 指标: '最高温度', 值: formatTemperature(selectedReport.summary.maxTemperature) },
              { 指标: '异常总数', 值: selectedReport.summary.anomalyCount },
            ],
            '异常列表': selectedReport.anomalies.map(a => ({
              异常ID: a.id,
              类型: a.type,
              严重程度: a.severity,
              状态: a.status,
              描述: a.description,
              检测时间: formatTimestamp(a.detectedAt),
            })),
          };
          exportToExcel(excelData, `report_${selectedReport.id}_${Date.now()}.xlsx`);
          break;
      }
      setShowExportModal(false);
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setExporting(false);
    }
  };

  const formatOptions = [
    { value: 'excel', label: 'Excel', icon: <FileSpreadsheet size={16} />, desc: '多工作表格式' },
    { value: 'csv', label: 'CSV', icon: <File size={16} />, desc: '通用文本格式' },
    { value: 'json', label: 'JSON', icon: <FileJson size={16} />, desc: '结构化数据' },
  ];

  return (
    <MainLayout onRefresh={loadDashboardData} onImport={handleGenerateReport}>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">分析报告</h1>
            <p className="text-sm text-slate-400 mt-1">
              设备 {currentDeviceId} · 全链路可追溯分析报告
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-primary flex items-center gap-2 py-1.5"
              onClick={handleGenerateReport}
              disabled={generating}
            >
              <Plus size={16} className={generating ? 'animate-spin' : ''} />
              <span>生成新报告</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <DataCard
            title="报告总数"
            value={reports.length.toString()}
            unit="份"
            icon={<FileText size={18} />}
          />
          <DataCard
            title="本月生成"
            value={(reports.length > 0 ? reports.length : 0).toString()}
            unit="份"
            icon={<FileText size={18} />}
          />
          <DataCard
            title="含异常报告"
            value={reports.filter(r => r.summary.anomalyCount > 0).length.toString()}
            unit="份"
            icon={<FileText size={18} />}
            highlight={reports.filter(r => r.summary.anomalyCount > 0).length > 0}
          />
          <DataCard
            title="平均异常数"
            value={reports.length > 0 ? (reports.reduce((sum, r) => sum + r.summary.anomalyCount, 0) / reports.length).toFixed(1) : '0'}
            unit="个/份"
            icon={<FileText size={18} />}
          />
        </div>

        <div className="card overflow-hidden">
          <div className="card-header">
            <span className="text-sm font-medium text-slate-200">报告列表</span>
            <span className="text-xs text-slate-500">点击查看详情，数据可一路追溯至原始采样</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="table-header sticky top-0">
                <tr>
                  <th className="table-cell text-left">报告编号</th>
                  <th className="table-cell text-left">设备</th>
                  <th className="table-cell text-left">生成时间</th>
                  <th className="table-cell text-left">分析人</th>
                  <th className="table-cell text-left">采样数</th>
                  <th className="table-cell text-left">工况段</th>
                  <th className="table-cell text-left">平均扭矩</th>
                  <th className="table-cell text-left">最高温度</th>
                  <th className="table-cell text-left">异常数</th>
                  <th className="table-cell text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    className="transition-colors hover:bg-slate-700/30 cursor-pointer"
                    onClick={() => viewDetail(report)}
                  >
                    <td className="table-cell font-mono text-xs text-blue-400">
                      #{report.id?.slice(-8)}
                    </td>
                    <td className="table-cell text-xs text-slate-300">{report.deviceId}</td>
                    <td className="table-cell font-mono text-xs text-slate-300">
                      {formatTimestamp(report.generatedAt)}
                    </td>
                    <td className="table-cell text-xs text-slate-300">{report.generatedBy}</td>
                    <td className="table-cell font-mono text-xs text-slate-400">
                      {report.summary.totalSamples}
                    </td>
                    <td className="table-cell font-mono text-xs text-slate-400">
                      {report.summary.totalSegments}
                    </td>
                    <td className="table-cell font-mono text-xs text-emerald-400">
                      {formatTorque(report.summary.avgTorque)}
                    </td>
                    <td className="table-cell font-mono text-xs">
                      <span className={report.summary.maxTemperature > 130 ? 'text-red-400' : 'text-slate-300'}>
                        {formatTemperature(report.summary.maxTemperature)}
                      </span>
                    </td>
                    <td className="table-cell">
                      {report.summary.anomalyCount > 0 ? (
                        <span className="text-xs font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded-sm">
                          {report.summary.anomalyCount}
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-400">无</span>
                      )}
                    </td>
                    <td className="table-cell text-right">
                      <button
                        className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          viewDetail(report);
                        }}
                        title="查看详情"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        className="p-1 text-slate-400 hover:text-emerald-400 transition-colors ml-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExport(report);
                        }}
                        title="导出报告"
                      >
                        <Download size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={10} className="table-cell text-center py-8 text-slate-500">
                      暂无报告，点击上方按钮生成第一份分析报告
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Modal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title="分析报告详情 - 全链路可追溯"
          size="xl"
        >
          {selectedReport && (
            <div className="space-y-6">
              <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-blue-400 mb-1">🔗 报告溯源标识</div>
                    <div className="text-sm font-mono text-slate-300">
                      报告 #{selectedReport.id} · 生成于 {formatTimestamp(selectedReport.generatedAt)}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    分析人: {selectedReport.generatedBy}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-900/50 p-4 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">总采样数</div>
                  <div className="text-2xl font-mono text-slate-200">{selectedReport.summary.totalSamples}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">工况段数</div>
                  <div className="text-2xl font-mono text-slate-200">{selectedReport.summary.totalSegments}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">测试时长</div>
                  <div className="text-lg font-mono text-slate-200">{formatDuration(selectedReport.summary.totalDuration)}</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-sm border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">异常数</div>
                  <div className={`text-2xl font-mono ${selectedReport.summary.anomalyCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {selectedReport.summary.anomalyCount}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-sm">
                  <div className="text-xs text-emerald-400 mb-2">扭矩统计</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-slate-500">平均</div>
                      <div className="text-sm font-mono text-emerald-400">{formatTorque(selectedReport.summary.avgTorque)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">最大</div>
                      <div className="text-sm font-mono text-emerald-300">{formatTorque(selectedReport.summary.maxTorque)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">最小</div>
                      <div className="text-sm font-mono text-emerald-400">{formatTorque(selectedReport.summary.minTorque)}</div>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-sm">
                  <div className="text-xs text-slate-400 mb-2">温度统计</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-slate-500">平均</div>
                      <div className="text-sm font-mono text-slate-300">{formatTemperature(selectedReport.summary.avgTemperature)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">最高</div>
                      <div className={`text-sm font-mono ${selectedReport.summary.maxTemperature > 130 ? 'text-red-400' : 'text-slate-300'}`}>
                        {formatTemperature(selectedReport.summary.maxTemperature)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">转速</div>
                      <div className="text-sm font-mono text-blue-400">{formatSpeed(selectedReport.summary.avgSpeed)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-sm border border-slate-700">
                <div className="text-xs text-slate-400 mb-3">工况段明细（点击可跳转定位）</div>
                <div className="overflow-x-auto max-h-48 scrollbar-thin">
                  <table className="w-full text-xs">
                    <thead className="table-header">
                      <tr>
                        <th className="table-cell text-left">负载档</th>
                        <th className="table-cell text-left">采样数</th>
                        <th className="table-cell text-left">平均扭矩</th>
                        <th className="table-cell text-left">最高温度</th>
                        <th className="table-cell text-left">状态</th>
                        <th className="table-cell text-left">追溯</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReport.segments.map((seg, idx) => (
                        <tr key={idx} className="hover:bg-slate-700/30">
                          <td className="table-cell text-amber-400 font-mono">{seg.loadLevel} 档</td>
                          <td className="table-cell font-mono">{seg.sampleCount}</td>
                          <td className="table-cell text-emerald-400 font-mono">{formatTorque(seg.avgTorque)}</td>
                          <td className={`table-cell font-mono ${seg.maxTemperature > 130 ? 'text-red-400' : 'text-slate-300'}`}>
                            {formatTemperature(seg.maxTemperature)}
                          </td>
                          <td className="table-cell">
                            {seg.hasAnomaly ? (
                              <span className="text-red-400">含异常</span>
                            ) : (
                              <span className="text-emerald-400">正常</span>
                            )}
                          </td>
                          <td className="table-cell">
                            <button
                              className="text-xs text-blue-400 hover:text-blue-300"
                              onClick={() => {
                                useAppStore.getState().setSelectedSegmentId(seg.id!);
                                setDetailModalOpen(false);
                                window.location.href = '/analysis';
                              }}
                            >
                              查看 →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedReport.anomalies.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-sm">
                  <div className="text-xs text-red-400 mb-3">异常事件汇总（点击可跳转定位）</div>
                  <div className="overflow-x-auto max-h-48 scrollbar-thin">
                    <table className="w-full text-xs">
                      <thead className="table-header">
                        <tr>
                          <th className="table-cell text-left">类型</th>
                          <th className="table-cell text-left">严重程度</th>
                          <th className="table-cell text-left">状态</th>
                          <th className="table-cell text-left">描述</th>
                          <th className="table-cell text-left">检测时间</th>
                          <th className="table-cell text-left">追溯</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReport.anomalies.map((a, idx) => (
                          <tr key={idx} className="hover:bg-slate-700/30">
                            <td className="table-cell">
                              <StatusBadge type="anomalyType" value={a.type} />
                            </td>
                            <td className="table-cell">
                              <StatusBadge type="severity" value={a.severity} />
                            </td>
                            <td className="table-cell">
                              <StatusBadge type="status" value={a.status} />
                            </td>
                            <td className="table-cell text-slate-300">{a.description}</td>
                            <td className="table-cell font-mono">{formatTimestamp(a.detectedAt)}</td>
                            <td className="table-cell">
                              <button
                                className="text-xs text-blue-400 hover:text-blue-300"
                                onClick={() => {
                                  useAppStore.getState().highlightAnomaly(a.id!);
                                  setDetailModalOpen(false);
                                  window.location.href = '/analysis';
                                }}
                              >
                                定位 →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-sm">
                <div className="text-xs text-slate-400 mb-3">🔗 溯源映射（报告数据 → 原始采样）</div>
                <div className="text-xs text-slate-500">
                  本报告包含 {Object.keys(selectedReport.sampleIdMap).length} 个可追溯数据点。
                  每个报告中的数字都可以通过 sampleIdMap 一路点回原始采样明细。
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(selectedReport.sampleIdMap).slice(0, 10).map(([key, value]) => (
                    <span key={key} className="text-xs font-mono bg-slate-800 px-2 py-1 rounded-sm">
                      {key}: #{value.slice(-8)}
                    </span>
                  ))}
                  {Object.keys(selectedReport.sampleIdMap).length > 10 && (
                    <span className="text-xs text-slate-500">
                      ... 还有 {Object.keys(selectedReport.sampleIdMap).length - 10} 个映射
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="btn btn-ghost"
                  onClick={() => setDetailModalOpen(false)}
                >
                  关闭
                </button>
                <button
                  className="btn btn-primary flex items-center gap-2"
                  onClick={() => {
                    handleExport(selectedReport);
                    setDetailModalOpen(false);
                  }}
                >
                  <Download size={14} />
                  导出报告
                </button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          title="选择导出格式"
          size="sm"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              {formatOptions.map((opt) => (
                <div
                  key={opt.value}
                  className={`p-3 rounded-sm border cursor-pointer transition-all ${
                    exportFormat === opt.value
                      ? 'bg-blue-500/10 border-blue-500/50'
                      : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700/50'
                  }`}
                  onClick={() => setExportFormat(opt.value as typeof exportFormat)}
                >
                  <div className="flex items-center gap-3">
                    <div className={exportFormat === opt.value ? 'text-blue-400' : 'text-slate-400'}>
                      {opt.icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-slate-200">{opt.label}</div>
                      <div className="text-xs text-slate-500">{opt.desc}</div>
                    </div>
                    {exportFormat === opt.value && (
                      <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="btn btn-ghost"
                onClick={() => setShowExportModal(false)}
              >
                取消
              </button>
              <button
                className="btn btn-primary flex items-center gap-2"
                onClick={executeExport}
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    开始导出
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>

        {generating && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="card p-8 text-center">
              <div className="w-16 h-16 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <div className="text-base text-slate-300 font-medium">正在生成分析报告</div>
              <div className="text-xs text-slate-500 mt-3 space-y-1">
                <div>✓ 汇总统计数据</div>
                <div>✓ 整理工况段信息</div>
                <div className="text-emerald-400">⟳ 生成溯源映射...</div>
                <div className="text-slate-600">○ 持久化存储</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Reports;
