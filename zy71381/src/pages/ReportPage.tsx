import React, { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useDependencyStore } from '../store/dependencyStore';
import { useReportStore } from '../store/reportStore';
import { ProjectSelector } from '../components/ProjectSelector';
import { RiskBadge } from '../components/RiskBadge';
import {
  FileCheck,
  Plus,
  Download,
  Eye,
  Trash2,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Clock,
  BarChart3,
  PieChart,
  FileJson,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Hash,
} from 'lucide-react';
import type { ComplianceReport, ReportFormat } from '../types';
import { RISK_LEVEL_LABELS, DEPENDENCY_STATUS_LABELS, REPORT_STATUS_LABELS } from '../types';
import dayjs from 'dayjs';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const RISK_COLORS: Record<string, string> = {
  critical: '#dc2626',
  warning: '#d97706',
  safe: '#059669',
  unknown: '#6b7280',
};

export function ReportPage() {
  const { currentProject } = useProjectStore();
  const { dependencies, loadDependencies } = useDependencyStore();
  const {
    reports,
    loading,
    generating,
    loadReports,
    generateReport,
    exportReport,
    verifyReport,
    deleteReport,
  } = useReportStore();

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ComplianceReport | null>(null);
  const [exportFormat, setExportFormat] = useState<ReportFormat>('json');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportNotes, setReportNotes] = useState('');

  useEffect(() => {
    if (currentProject) {
      loadDependencies(currentProject.id);
      loadReports(currentProject.id);
    }
  }, [currentProject, loadDependencies, loadReports]);

  const readyDeps = dependencies.filter(
    (d) => d.status === 'approved' || d.status === 'waiver_approved'
  );

  const canGenerate = readyDeps.length > 0;

  const handleGenerate = async () => {
    if (!currentProject || !canGenerate) return;
    await generateReport(currentProject.id, {
      title: reportTitle || `${currentProject.name} 合规报告`,
      notes: reportNotes,
    });
    setShowGenerateModal(false);
    setReportTitle('');
    setReportNotes('');
  };

  const handleExport = async (report: ComplianceReport, format: ReportFormat) => {
    await exportReport(report.id, format);
  };

  const openReportDetail = (report: ComplianceReport) => {
    setSelectedReport(report);
    setShowDetailModal(true);
  };

  const renderRiskChart = () => {
    if (!selectedReport) return null;
    const data = [
      { name: '高风险', value: selectedReport.stats.riskBreakdown.critical, color: RISK_COLORS.critical },
      { name: '中风险', value: selectedReport.stats.riskBreakdown.warning, color: RISK_COLORS.warning },
      { name: '低风险', value: selectedReport.stats.riskBreakdown.safe, color: RISK_COLORS.safe },
      { name: '未知', value: selectedReport.stats.riskBreakdown.unknown, color: RISK_COLORS.unknown },
    ].filter((d) => d.value > 0);

    return (
      <ResponsiveContainer width="100%" height={200}>
        <RechartsPie>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </RechartsPie>
      </ResponsiveContainer>
    );
  };

  const renderLicenseChart = () => {
    if (!selectedReport) return null;
    const data = Object.entries(selectedReport.stats.licenseBreakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="value" fill="#0d9488" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const getCardClass = (status: string) => {
    switch (status) {
      case 'final':
        return 'border-primary-400 bg-primary-50/30';
      case 'draft':
      default:
        return 'border-slate-200';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-slate-900">
            合规报告
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            生成合规审查报告，支持多格式导出，哈希校验确保数据一致
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ProjectSelector />
          <button
            onClick={() => setShowGenerateModal(true)}
            className="btn-primary flex items-center gap-2"
            disabled={!canGenerate || generating}
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                生成报告
              </>
            )}
          </button>
        </div>
      </div>

      {currentProject ? (
        <>
          {!canGenerate && dependencies.length > 0 && (
            <div className="card p-4 bg-amber-50 border-amber-300">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">暂无可用数据</p>
                  <p className="text-sm text-amber-700">
                    请先在审查页完成依赖审查。已通过或豁免的依赖才能加入报告。
                    待审查依赖：{dependencies.filter((d) => d.status === 'pending_review' || d.status === 'parsed_normal').length}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-4">
            <div className="card p-4 bg-slate-50">
              <p className="text-xs text-slate-500 mb-1">报告总数</p>
              <p className="text-2xl font-bold font-mono text-slate-900">{reports.length}</p>
            </div>
            <div className="card p-4 bg-primary-50">
              <p className="text-xs text-primary-600 mb-1">正式发布</p>
              <p className="text-2xl font-bold font-mono text-primary-600">
                {reports.filter((r) => r.status === 'final').length}
              </p>
            </div>
            <div className="card p-4 bg-emerald-50">
              <p className="text-xs text-risk-safe mb-1">已通过</p>
              <p className="text-2xl font-bold font-mono text-risk-safe">{readyDeps.filter((d) => d.status === 'approved').length}</p>
            </div>
            <div className="card p-4 bg-blue-50">
              <p className="text-xs text-blue-600 mb-1">已豁免</p>
              <p className="text-2xl font-bold font-mono text-blue-600">{readyDeps.filter((d) => d.status === 'waiver_approved').length}</p>
            </div>
          </div>

          {reports.length === 0 ? (
            <div className="card p-12 text-center">
              <FileCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="font-serif text-xl font-semibold text-slate-700 mb-2">
                暂无报告
              </h3>
              <p className="text-slate-500 mb-4">
                {canGenerate ? '点击右上角生成合规报告' : '请先完成依赖审查流程'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...reports].reverse().map((report) => (
                <div key={report.id} className={`card p-4 ${getCardClass(report.status)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-slate-900">{report.title}</h4>
                        <span className={`badge ${report.status === 'final' ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-600'}`}>
                          {REPORT_STATUS_LABELS[report.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 mb-3 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <BarChart3 className="w-3.5 h-3.5" />
                          依赖总数: {report.stats.total}
                        </span>
                        <span className="flex items-center gap-1 text-risk-critical">
                          <AlertCircle className="w-3.5 h-3.5" />
                          高风险: {report.stats.riskBreakdown.critical}
                        </span>
                        <span className="flex items-center gap-1 text-risk-warning">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          中风险: {report.stats.riskBreakdown.warning}
                        </span>
                        <span className="flex items-center gap-1 text-risk-safe">
                          <CheckCircle className="w-3.5 h-3.5" />
                          低风险: {report.stats.riskBreakdown.safe}
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <HelpCircle className="w-3.5 h-3.5" />
                          未知: {report.stats.riskBreakdown.unknown}
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          {dayjs(report.generatedAt).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1 text-slate-500 font-mono">
                          <Hash className="w-3 h-3" />
                          SHA256: {report.contentHash.slice(0, 16)}...
                        </span>
                        {report.verificationStatus === 'verified' && (
                          <span className="badge bg-emerald-100 text-emerald-700 text-[10px] flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            校验通过
                          </span>
                        )}
                        {report.verificationStatus === 'failed' && (
                          <span className="badge bg-red-100 text-risk-critical text-[10px] flex items-center gap-1">
                            <XCircle className="w-2.5 h-2.5" />
                            校验失败
                          </span>
                        )}
                        {report.verificationStatus === 'pending' && (
                          <button
                            onClick={() => verifyReport(report.id)}
                            className="text-xs text-primary-600 hover:text-primary-700"
                          >
                            点击校验
                          </button>
                        )}
                      </div>
                      {report.notes && (
                        <p className="text-xs text-slate-500 mt-2">
                          备注: {report.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => openReportDetail(report)}
                        className="btn-primary text-xs py-1 px-2 flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        查看
                      </button>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleExport(report, 'json')}
                          className="p-1 hover:bg-slate-100 rounded"
                          title="导出 JSON"
                        >
                          <FileJson className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                        <button
                          onClick={() => handleExport(report, 'csv')}
                          className="p-1 hover:bg-slate-100 rounded"
                          title="导出 CSV"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        </button>
                        <button
                          onClick={() => handleExport(report, 'markdown')}
                          className="p-1 hover:bg-slate-100 rounded"
                          title="导出 Markdown"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('确定删除该报告？')) {
                            deleteReport(report.id);
                          }
                        }}
                        className="p-1 hover:bg-red-100 rounded text-red-500 text-xs"
                        title="删除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="card p-12 text-center">
          <FileCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-serif text-xl font-semibold text-slate-700 mb-2">
            请先选择项目
          </h3>
          <p className="text-slate-500">
            选择项目后可生成和管理合规报告
          </p>
        </div>
      )}

      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[500px] shadow-xl animate-slide-up">
            <h3 className="font-serif text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary-600" />
              生成合规报告
            </h3>
            <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-md">
              <p className="text-sm text-primary-700">
                将包含 <strong>{readyDeps.length}</strong> 个已通过/豁免的依赖
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  报告标题
                </label>
                <input
                  type="text"
                  className="input"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder={currentProject ? `${currentProject.name} 合规报告` : '合规报告'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  备注说明
                </label>
                <textarea
                  className="textarea h-20"
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="说明报告用途、发版版本等信息..."
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  className="btn-secondary"
                  onClick={() => setShowGenerateModal(false)}
                >
                  取消
                </button>
                <button
                  className="btn-primary"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  生成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-8">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-slide-up">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-slate-900">
                {selectedReport.title}
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <XCircle className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] scrollbar-thin">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="card p-4">
                  <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <PieChart className="w-4 h-4" />
                    风险分布
                  </h4>
                  {renderRiskChart()}
                </div>
                <div className="card p-4">
                  <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    许可证分布
                  </h4>
                  {renderLicenseChart()}
                </div>
              </div>

              <div className="card p-4 mb-6">
                <h4 className="font-semibold text-slate-700 mb-3">统计概览</h4>
                <div className="grid grid-cols-5 gap-4">
                  <div className="text-center p-3 bg-slate-50 rounded-md">
                    <p className="text-2xl font-bold font-mono text-slate-900">{selectedReport.stats.total}</p>
                    <p className="text-xs text-slate-500">依赖总数</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-md">
                    <p className="text-2xl font-bold font-mono text-risk-critical">{selectedReport.stats.riskBreakdown.critical}</p>
                    <p className="text-xs text-slate-500">高风险</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-md">
                    <p className="text-2xl font-bold font-mono text-risk-warning">{selectedReport.stats.riskBreakdown.warning}</p>
                    <p className="text-xs text-slate-500">中风险</p>
                  </div>
                  <div className="text-center p-3 bg-emerald-50 rounded-md">
                    <p className="text-2xl font-bold font-mono text-risk-safe">{selectedReport.stats.riskBreakdown.safe}</p>
                    <p className="text-xs text-slate-500">低风险</p>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-md">
                    <p className="text-2xl font-bold font-mono text-slate-700">{selectedReport.stats.riskBreakdown.unknown}</p>
                    <p className="text-xs text-slate-500">未知</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-md">
                    <p className="text-xl font-bold font-mono text-blue-600">{selectedReport.stats.directCount}</p>
                    <p className="text-xs text-slate-500">直接依赖</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-md">
                    <p className="text-xl font-bold font-mono text-purple-600">{selectedReport.stats.transitiveCount}</p>
                    <p className="text-xs text-slate-500">传递依赖</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-md">
                    <p className="text-xl font-bold font-mono text-blue-600">{selectedReport.stats.waiverCount}</p>
                    <p className="text-xs text-slate-500">豁免依赖</p>
                  </div>
                </div>
              </div>

              <div className="card p-4 mb-6">
                <h4 className="font-semibold text-slate-700 mb-3">合规结论</h4>
                <div className={`p-4 rounded-md ${
                  selectedReport.complianceResult.passed
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {selectedReport.complianceResult.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-risk-safe" />
                    ) : (
                      <XCircle className="w-5 h-5 text-risk-critical" />
                    )}
                    <span className={`font-semibold ${
                      selectedReport.complianceResult.passed ? 'text-risk-safe' : 'text-risk-critical'
                    }`}>
                      {selectedReport.complianceResult.passed ? '通过合规审查' : '未通过合规审查'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {selectedReport.complianceResult.summary}
                  </p>
                </div>
              </div>

              <div className="card p-4">
                <h4 className="font-semibold text-slate-700 mb-3">依赖清单</h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="table-cell text-left text-xs text-slate-600 font-medium py-2">包名</th>
                        <th className="table-cell text-left text-xs text-slate-600 font-medium py-2">版本</th>
                        <th className="table-cell text-left text-xs text-slate-600 font-medium py-2">许可证</th>
                        <th className="table-cell text-left text-xs text-slate-600 font-medium py-2">风险</th>
                        <th className="table-cell text-left text-xs text-slate-600 font-medium py-2">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReport.dependencies.map((dep, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="table-cell py-2 font-mono text-sm">{dep.packageName}</td>
                          <td className="table-cell py-2 font-mono text-sm">{dep.packageVersion}</td>
                          <td className="table-cell py-2 font-mono text-xs">
                            {Array.isArray(dep.license) ? dep.license.join(' / ') : dep.license}
                          </td>
                          <td className="table-cell py-2">
                            <RiskBadge level={dep.riskLevel} size="sm" showIcon={false} />
                          </td>
                          <td className="table-cell py-2 text-xs text-slate-600">
                            {DEPENDENCY_STATUS_LABELS[dep.status]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 p-4 bg-slate-50 rounded-md">
                <div className="flex items-center justify-between text-sm">
                  <div className="space-y-1">
                    <p className="text-slate-600">
                      <span className="text-slate-500">生成时间：</span>
                      {dayjs(selectedReport.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
                    </p>
                    <p className="text-slate-600">
                      <span className="text-slate-500">报告版本：</span>
                      v{selectedReport.version}
                    </p>
                    <p className="text-slate-600 font-mono text-xs">
                      <span className="text-slate-500">内容哈希：</span>
                      {selectedReport.contentHash}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">导出：</span>
                    <button
                      onClick={() => handleExport(selectedReport, 'json')}
                      className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                    >
                      <FileJson className="w-3 h-3" />
                      JSON
                    </button>
                    <button
                      onClick={() => handleExport(selectedReport, 'csv')}
                      className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                    >
                      <FileSpreadsheet className="w-3 h-3" />
                      CSV
                    </button>
                    <button
                      onClick={() => handleExport(selectedReport, 'markdown')}
                      className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      MD
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
