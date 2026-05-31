import { useState, useMemo } from 'react';
import {
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  CheckSquare,
  Square,
  BarChart3,
  AlertCircle,
  Shield,
  Lightbulb,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { SOURCE_LABELS } from '@/types';
import type { ExportReport } from '@/types';
import StatCard from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import PermissionDiff from '@/components/PermissionDiff';

export default function Export() {
  const generateExportReport = useAppStore(state => state.generateExportReport);
  const exportReportJson = useAppStore(state => state.exportReportJson);
  const exportReportExcel = useAppStore(state => state.exportReportExcel);
  const getFilteredRecords = useAppStore(state => state.getFilteredRecords);

  const [report, setReport] = useState<ExportReport | null>(null);
  const [checklist, setChecklist] = useState({
    keyMetricsChecked: false,
    abnormalRecordsChecked: false,
    permissionChangesChecked: false,
  });
  const [selectedPermIndex, setSelectedPermIndex] = useState<number | null>(null);

  const filteredRecords = useMemo(() => getFilteredRecords(), [getFilteredRecords]);

  const canExport = checklist.keyMetricsChecked &&
    checklist.abnormalRecordsChecked &&
    checklist.permissionChangesChecked;

  const handleGenerateReport = () => {
    const newReport = generateExportReport();
    setReport(newReport);
    setChecklist({
      keyMetricsChecked: false,
      abnormalRecordsChecked: false,
      permissionChangesChecked: false,
    });
    setSelectedPermIndex(null);
  };

  const handleExportJson = () => {
    if (report && canExport) {
      exportReportJson(report);
    }
  };

  const handleExportExcel = () => {
    if (report && canExport) {
      exportReportExcel(report);
    }
  };

  const toggleCheck = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">导出迁移报告</h1>
          <p className="mt-1 text-slate-400 text-sm">
            导出前请完成三项复核，确保报告准确完整
          </p>
        </div>
        <button
          onClick={handleGenerateReport}
          className="px-5 py-2.5 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors flex items-center gap-2 font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          生成报告
        </button>
      </div>

      {!report ? (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-700/50 rounded-full flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">尚未生成报告</h3>
          <p className="text-slate-400 text-sm mb-4">
            当前筛选条件下共有 <span className="text-cyan-400 font-medium">{filteredRecords.length}</span> 条记录
          </p>
          <button
            onClick={handleGenerateReport}
            className="px-6 py-2.5 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors inline-flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            生成迁移报告
          </button>
        </div>
      ) : (
        <>
          <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">报告已生成</h3>
                  <p className="text-slate-400 text-sm">
                    生成时间：{report.generatedAt} · 操作人：{report.generatedBy}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportJson}
                  disabled={!canExport}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
                    canExport
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <FileJson className="w-4 h-4" />
                  导出 JSON
                </button>
                <button
                  onClick={handleExportExcel}
                  disabled={!canExport}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
                    canExport
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  导出 Excel
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 border border-amber-500/30 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-amber-500/20 bg-amber-500/5 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <h3 className="text-amber-400 font-semibold">导出前复核清单</h3>
              <span className={`ml-auto text-sm ${canExport ? 'text-emerald-400' : 'text-slate-500'}`}>
                {Object.values(checklist).filter(Boolean).length} / 3 已完成
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/30 cursor-pointer transition-colors"
                onClick={() => toggleCheck('keyMetricsChecked')}
              >
                {checklist.keyMetricsChecked ? (
                  <CheckSquare className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-slate-500 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${checklist.keyMetricsChecked ? 'text-emerald-400' : 'text-white'}`}>
                    关键指标复核
                  </p>
                  <p className="text-slate-500 text-xs">确认总记录数、完成率、各状态数量等核心指标正确</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>

              <div
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/30 cursor-pointer transition-colors"
                onClick={() => toggleCheck('abnormalRecordsChecked')}
              >
                {checklist.abnormalRecordsChecked ? (
                  <CheckSquare className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-slate-500 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${checklist.abnormalRecordsChecked ? 'text-emerald-400' : 'text-white'}`}>
                    异常记录复核
                  </p>
                  <p className="text-slate-500 text-xs">
                    检查{report.abnormalRecords.length}条异常记录（状态异常+幂等键失效），确认处理方案
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>

              <div
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/30 cursor-pointer transition-colors"
                onClick={() => toggleCheck('permissionChangesChecked')}
              >
                {checklist.permissionChangesChecked ? (
                  <CheckSquare className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-slate-500 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${checklist.permissionChangesChecked ? 'text-emerald-400' : 'text-white'}`}>
                    权限变更复核
                  </p>
                  <p className="text-slate-500 text-xs">
                    确认{report.permissionChanges.length}条权限变更记录，前后差异与变更原因一致
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              统计概览
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="总记录数"
                value={report.statistics.total}
                icon={BarChart3}
                color="#06B6D4"
                subtitle={`完成率 ${report.statistics.completionRate}%`}
              />
              <StatCard
                title="待处理"
                value={report.statistics.pending}
                icon={AlertCircle}
                color="#F59E0B"
                subtitle="需要人工处理"
              />
              <StatCard
                title="已完成"
                value={report.statistics.completed}
                icon={CheckCircle2}
                color="#10B981"
                subtitle="正常释放完成"
              />
              <StatCard
                title="异常/幂等失效"
                value={report.statistics.error + report.statistics.idempotentInvalid}
                icon={AlertTriangle}
                color="#EF4444"
                subtitle={`异常${report.statistics.error} · 失效${report.statistics.idempotentInvalid}`}
              />
            </div>
          </div>

          {report.suggestions.length > 0 && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-700/50 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                <h3 className="text-white font-semibold">智能建议</h3>
              </div>
              <div className="p-4 space-y-2">
                {report.suggestions.map((suggestion, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span className="text-slate-300">{suggestion}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.abnormalRecords.length > 0 && (
            <div className="bg-slate-800/30 border border-red-500/30 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-red-500/20 bg-red-500/5 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h3 className="text-red-400 font-semibold">异常记录列表</h3>
                <span className="ml-auto text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                  {report.abnormalRecords.length} 条
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/50">
                    <tr className="text-left text-slate-400">
                      <th className="px-4 py-3 font-medium">库存编码</th>
                      <th className="px-4 py-3 font-medium">接口名称</th>
                      <th className="px-4 py-3 font-medium">状态</th>
                      <th className="px-4 py-3 font-medium">问题</th>
                      <th className="px-4 py-3 font-medium">操作人</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {report.abnormalRecords.map(record => (
                      <tr key={record.id} className="hover:bg-slate-700/30">
                        <td className="px-4 py-3 font-mono text-white">{record.stockCode}</td>
                        <td className="px-4 py-3 text-white">{record.interfaceName}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={record.status} size="sm" />
                        </td>
                        <td className="px-4 py-3">
                          {!record.idempotentValid ? (
                            <span className="text-red-400 text-xs">幂等键失效</span>
                          ) : record.status === 'error' ? (
                            <span className="text-red-400 text-xs">{record.pendingReason || '状态异常'}</span>
                          ) : (
                            <span className="text-amber-400 text-xs">{record.pendingReason || '待处理'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{record.operator}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report.permissionChanges.length > 0 && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-700/50 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                <h3 className="text-white font-semibold">权限变更记录</h3>
                <span className="ml-auto text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                  {report.permissionChanges.length} 条
                </span>
              </div>
              <div className="divide-y divide-slate-700/50">
                {report.permissionChanges.map((change, index) => (
                  <div key={change.id}>
                    <div
                      className="p-4 flex items-center justify-between hover:bg-slate-700/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedPermIndex(selectedPermIndex === index ? null : index)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                          <span className="text-purple-400 text-xs font-medium">{index + 1}</span>
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">
                            {change.operator} 变更了权限配置
                          </p>
                          <p className="text-slate-500 text-xs">
                            {change.createdAt} · {change.changeReason}
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-5 h-5 text-slate-500 transition-transform ${
                          selectedPermIndex === index ? 'rotate-90' : ''
                        }`}
                      />
                    </div>
                    {selectedPermIndex === index && (
                      <div className="px-4 pb-4">
                        <PermissionDiff
                          before={change.beforePermission}
                          after={change.afterPermission}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">报告明细预览（前10条）</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/50">
                  <tr className="text-left text-slate-400">
                    <th className="px-4 py-3 font-medium">库存编码</th>
                    <th className="px-4 py-3 font-medium">接口名称</th>
                    <th className="px-4 py-3 font-medium">来源</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">预占</th>
                    <th className="px-4 py-3 font-medium">已释放</th>
                    <th className="px-4 py-3 font-medium">操作人</th>
                    <th className="px-4 py-3 font-medium">幂等键</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {report.records.slice(0, 10).map(record => (
                    <tr key={record.id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3 font-mono text-white">{record.stockCode}</td>
                      <td className="px-4 py-3 text-white">{record.interfaceName}</td>
                      <td className="px-4 py-3 text-slate-400">{SOURCE_LABELS[record.source]}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={record.status} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-white">{record.preOccupyQty}</td>
                      <td className="px-4 py-3 text-white">{record.releaseQty}</td>
                      <td className="px-4 py-3 text-slate-400">{record.operator}</td>
                      <td className="px-4 py-3">
                        <span className={`font-mono text-xs ${record.idempotentValid ? 'text-emerald-400' : 'text-red-400'}`}>
                          {record.idempotentKey.slice(0, 12)}...
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.records.length > 10 && (
              <p className="text-center text-slate-500 text-sm mt-4">
                还有 {report.records.length - 10} 条记录未显示，完整内容请查看导出文件
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
