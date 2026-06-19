import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  Calculator,
  AlertTriangle,
  ArrowRight,
  Edit3,
  Download,
  History,
  AlertCircle,
  Users,
  X,
  Save,
  RefreshCw,
} from 'lucide-react';
import WorkflowStepper from '../components/WorkflowStepper';
import ImportZone from '../components/ImportZone';
import { useForecastStore } from '../store/forecastStore';
import type { ImportResult, ParameterRecord, ParameterUpdateRequest } from '../types';
import { cn } from '../lib/utils';

export default function Workbench() {
  const navigate = useNavigate();
  const {
    fetchParameters,
    fetchCounterExamples,
    fetchConflicts,
    fetchWorkflowStatus,
    fetchAuditLogs,
    fetchMetadata,
    uploadParametersFile,
    uploadCounterExamplesFile,
    updateParameterRecord,
    calculateForecast,
    workflowState,
    parameterRecords,
    auditLogs,
    conflicts,
    loading,
    error,
  } = useForecastStore();

  const [paramImporting, setParamImporting] = useState(false);
  const [counterImporting, setCounterImporting] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ParameterRecord | null>(null);
  const [editForm, setEditForm] = useState({
    rawAlpha: '',
    rawBeta: '',
    rawGamma: '',
    forecastConclusion: '',
    reason: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'latest' | 'mixed' | 'history'>('latest');

  useEffect(() => {
    fetchParameters();
    fetchCounterExamples();
    fetchConflicts();
    fetchWorkflowStatus();
    fetchAuditLogs();
    fetchMetadata();
  }, []);

  const step1Completed = workflowState?.step1Completed ?? false;
  const step2Completed = workflowState?.step2Completed ?? false;
  const step3Completed = workflowState?.step3Completed ?? false;

  const pendingConflicts = conflicts.filter((c) => c.status === 'pending');
  const hasPendingConflicts = pendingConflicts.length > 0;
  const mixedRecords = parameterRecords.filter((r) => r.hasMixedFormat);
  const correctedRecords = parameterRecords.filter((r) => r.source === 'corrected');

  const handleParamImport = async (file: File): Promise<ImportResult> => {
    setParamImporting(true);
    try {
      const result = await uploadParametersFile(file, 'overwrite');
      await fetchAuditLogs();
      return result;
    } finally {
      setParamImporting(false);
    }
  };

  const handleCounterImport = async (file: File): Promise<ImportResult> => {
    setCounterImporting(true);
    try {
      const result = await uploadCounterExamplesFile(file);
      await fetchAuditLogs();
      return result;
    } finally {
      setCounterImporting(false);
    }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      await calculateForecast();
      await fetchWorkflowStatus();
      await fetchAuditLogs();
      navigate('/results');
    } finally {
      setCalculating(false);
    }
  };

  const handleResolveConflicts = () => navigate('/conflicts');
  const handleViewResults = () => navigate('/results');

  const handleDownloadSample = async (format: 'csv' | 'xlsx' = 'csv') => {
    const BASE_URL = import.meta.env.VITE_API_URL || '/api';
    const res = await fetch(`${BASE_URL}/forecast/parameters/sample.csv?format=${format}`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = format === 'csv' ? 'sample-parameters.csv' : 'sample-parameters.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const openEditDialog = (rec: ParameterRecord) => {
    setEditingRecord(rec);
    setEditForm({
      rawAlpha: rec.rawAlpha,
      rawBeta: rec.rawBeta,
      rawGamma: rec.rawGamma,
      forecastConclusion: rec.forecastConclusion,
      reason: '',
    });
  };

  const closeEditDialog = () => {
    setEditingRecord(null);
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    if (!editForm.reason.trim()) {
      alert('必须填写补录/修正理由');
      return;
    }
    setEditSaving(true);
    try {
      const update: ParameterUpdateRequest = {
        productId: editingRecord.productId,
        rawAlpha: editForm.rawAlpha,
        rawBeta: editForm.rawBeta,
        rawGamma: editForm.rawGamma,
        forecastConclusion: editForm.forecastConclusion,
        reason: editForm.reason.trim(),
        operator: '数据分析师小祁',
      };
      await updateParameterRecord(update);
      await fetchAuditLogs();
      closeEditDialog();
    } finally {
      setEditSaving(false);
    }
  };

  const canImportParams = true;
  const canImportCounter = step1Completed;
  const canResolveConflicts = step1Completed;
  const canCalculate = step2Completed && !hasPendingConflicts;
  const canViewResults = step3Completed;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">指数平滑销量预测工作台</h1>
          <p className="text-gray-600">导入参数数据、补录手算反例、处理冲突并执行预测计算</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">系统提示</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <WorkflowStepper workflowState={workflowState} loading={loading || calculating} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">参数调试表导入</h2>
                  <p className="text-sm text-gray-500">步骤1：导入产品参数与预测结论</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadSample('csv')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载 CSV 样例
                </button>
                <button
                  onClick={() => handleDownloadSample('xlsx')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载 XLSX 样例
                </button>
              </div>
            </div>
            <ImportZone
              title="上传参数调试表"
              description="拖拽或点击上传包含产品参数和预测结论的表格文件（真实解析，不再使用演示数据）"
              onImport={handleParamImport}
              disabled={!canImportParams || paramImporting || counterImporting}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calculator className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">手算反例补录</h2>
                <p className="text-sm text-gray-500">步骤2：导入人工核算的修正反例</p>
              </div>
            </div>
            <ImportZone
              title="上传手算反例表"
              description="拖拽或点击上传包含人工核算结果的反例文件"
              onImport={handleCounterImport}
              disabled={!canImportCounter || paramImporting || counterImporting}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">快速操作</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleResolveConflicts}
              disabled={!canResolveConflicts || loading || calculating}
              className={cn(
                'relative flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200',
                canResolveConflicts
                  ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 cursor-pointer'
                  : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              )}
            >
              {hasPendingConflicts && (
                <span className="absolute top-3 right-3 flex items-center justify-center min-w-[24px] h-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full">
                  {pendingConflicts.length}
                </span>
              )}
              <div className={cn('p-3 rounded-full mb-3', hasPendingConflicts ? 'bg-red-100' : 'bg-amber-100')}>
                <AlertTriangle className={cn('w-6 h-6', hasPendingConflicts ? 'text-red-600' : 'text-amber-600')} />
              </div>
              <span className={cn('font-semibold', hasPendingConflicts ? 'text-red-700' : 'text-gray-900')}>
                {hasPendingConflicts ? '待处理冲突' : '处理冲突'}
              </span>
              <span className="text-sm text-gray-500 mt-1">
                {hasPendingConflicts ? `${pendingConflicts.length} 条冲突待处理` : '查看并解决数据冲突'}
              </span>
            </button>

            <button
              onClick={handleCalculate}
              disabled={!canCalculate || loading || calculating}
              className={cn(
                'flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200',
                canCalculate
                  ? 'border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 cursor-pointer'
                  : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              )}
            >
              <div className="p-3 rounded-full bg-blue-100 mb-3">
                {calculating ? (
                  <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                ) : (
                  <Calculator className="w-6 h-6 text-blue-600" />
                )}
              </div>
              <span className="font-semibold text-gray-900">{calculating ? '计算中...' : '执行计算'}</span>
              <span className="text-sm text-gray-500 mt-1">
                {!step1Completed
                  ? '请先完成参数导入'
                  : hasPendingConflicts
                  ? '请先处理所有冲突'
                  : '运行指数平滑预测计算'}
              </span>
            </button>

            <button
              onClick={handleViewResults}
              disabled={!canViewResults || loading || calculating}
              className={cn(
                'flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200',
                canViewResults
                  ? 'border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 cursor-pointer'
                  : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              )}
            >
              <div className="p-3 rounded-full bg-green-100 mb-3">
                <ArrowRight className="w-6 h-6 text-green-600" />
              </div>
              <span className="font-semibold text-gray-900">查看结果</span>
              <span className="text-sm text-gray-500 mt-1">
                {step3Completed ? '查看预测计算结果明细' : '请先完成预测计算'}
              </span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="flex items-center gap-2 border-b border-gray-200">
            {([
              ['latest', '参数记录（最新版）', parameterRecords.length],
              ['mixed', '待复核（混合格式）', mixedRecords.length],
              ['history', '导入与变更历史', auditLogs.length],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  'px-5 py-3.5 text-sm font-medium transition-colors relative flex items-center gap-2',
                  activeTab === key
                    ? 'text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                )}
              >
                <span>{label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full',
                      activeTab === key
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {count}
                  </span>
                )}
                {activeTab === key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
                )}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'latest' && (
              <div>
                {parameterRecords.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">尚未导入参数。请先在上方上传参数调试表（CSV/XLSX）。</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left">
                          <th className="py-3 px-4 font-semibold text-gray-700">产品ID</th>
                          <th className="py-3 px-4 font-semibold text-gray-700">产品名称</th>
                          <th className="py-3 px-4 font-semibold text-gray-700">Alpha</th>
                          <th className="py-3 px-4 font-semibold text-gray-700">Beta</th>
                          <th className="py-3 px-4 font-semibold text-gray-700">Gamma</th>
                          <th className="py-3 px-4 font-semibold text-gray-700">预测结论</th>
                          <th className="py-3 px-4 font-semibold text-gray-700">版本</th>
                          <th className="py-3 px-4 font-semibold text-gray-700">状态</th>
                          <th className="py-3 px-4 font-semibold text-gray-700">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parameterRecords.map((rec) => (
                          <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                            <td className="py-3 px-4 font-mono text-xs text-gray-700">{rec.productId}</td>
                            <td className="py-3 px-4 text-gray-900">{rec.productName}</td>
                            <td className="py-3 px-4">
                              <RawValueBadge value={rec.rawAlpha} />
                            </td>
                            <td className="py-3 px-4">
                              <RawValueBadge value={rec.rawBeta} />
                            </td>
                            <td className="py-3 px-4">
                              <RawValueBadge value={rec.rawGamma} />
                            </td>
                            <td className="py-3 px-4 text-gray-700 font-medium">{rec.forecastConclusion}</td>
                            <td className="py-3 px-4 text-xs text-gray-500">v{rec.version}</td>
                            <td className="py-3 px-4">
                              <StatusBadge record={rec} />
                            </td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => openEditDialog(rec)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                              >
                                <Edit3 className="w-3 h-3" />
                                补录/修正
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'mixed' && (
              <div>
                {mixedRecords.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">暂未检测到百分数与小数混合格式的记录。</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
                      <div>
                        <p className="font-semibold mb-0.5">待活动负责人复核（共 {mixedRecords.length} 条）</p>
                        <p>以下记录 alpha/beta/gamma 同时出现百分数与小数格式，系统未自动归一化，需要人工确认最终取值。</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {mixedRecords.map((rec) => (
                        <div
                          key={rec.id}
                          className="p-4 rounded-lg border border-amber-200 bg-white hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-mono text-xs text-gray-500">{rec.productId}</p>
                              <p className="font-semibold text-gray-900">{rec.productName}</p>
                            </div>
                            <button
                              onClick={() => openEditDialog(rec)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md"
                            >
                              <Edit3 className="w-3 h-3" />
                              去修正
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Alpha</p>
                              <RawValueBadge value={rec.rawAlpha} />
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Beta</p>
                              <RawValueBadge value={rec.rawBeta} />
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Gamma</p>
                              <RawValueBadge value={rec.rawGamma} />
                            </div>
                          </div>
                          {rec.nextOwner && (
                            <p className="text-xs text-amber-700 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              下一步：{rec.nextOwner}
                            </p>
                          )}
                          {rec.changeReason && rec.source === 'corrected' && (
                            <p className="text-xs text-gray-500 mt-1">修正理由：{rec.changeReason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                {auditLogs.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">暂无操作历史。</p>
                  </div>
                ) : (
                  <div className="relative pl-8">
                    <div className="absolute left-3 top-1 bottom-1 w-px bg-gray-200" />
                    <ul className="space-y-4">
                      {auditLogs.slice(0, 50).map((log) => (
                        <li key={log.id} className="relative">
                          <span className="absolute -left-[22px] top-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-white border-2 border-gray-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                          </span>
                          <div className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-semibold text-gray-900">{log.summary}</p>
                              <span className="text-xs text-gray-400">
                                {new Date(log.timestamp).toLocaleString('zh-CN')}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span className="font-mono px-2 py-0.5 rounded bg-white border border-gray-200">{log.action}</span>
                              <span>经手人：{log.actor}</span>
                              {log.productIds.length > 0 && (
                                <span>
                                  影响：{log.productIds.slice(0, 3).join(', ')}
                                  {log.productIds.length > 3 ? ` 等 ${log.productIds.length} 条` : ''}
                                </span>
                              )}
                              {log.nextOwner && (
                                <span className="text-amber-600 flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  下一步 → {log.nextOwner}
                                </span>
                              )}
                            </div>
                            {log.reason && <p className="text-xs text-gray-500 mt-1">原因：{log.reason}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {editingRecord && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">参数补录/修正</h3>
                <p className="text-sm text-gray-500">
                  {editingRecord.productId} · {editingRecord.productName}
                </p>
              </div>
              <button
                onClick={closeEditDialog}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {editingRecord.previousValues && (
              <div className="px-6 py-3 bg-blue-50/50 border-b border-blue-100 text-xs text-blue-700">
                <p className="font-semibold mb-1">本次修改前的原始值（已保存到 previousValues，可追溯）</p>
                <div className="grid grid-cols-4 gap-2">
                  <div>Alpha：{editingRecord.previousValues.rawAlpha ?? '-'}</div>
                  <div>Beta：{editingRecord.previousValues.rawBeta ?? '-'}</div>
                  <div>Gamma：{editingRecord.previousValues.rawGamma ?? '-'}</div>
                  <div>结论：{editingRecord.previousValues.forecastConclusion ?? '-'}</div>
                </div>
              </div>
            )}

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Alpha（支持 0.3 或 30%）</label>
                  <input
                    value={editForm.rawAlpha}
                    onChange={(e) => setEditForm({ ...editForm, rawAlpha: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Beta</label>
                  <input
                    value={editForm.rawBeta}
                    onChange={(e) => setEditForm({ ...editForm, rawBeta: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Gamma</label>
                  <input
                    value={editForm.rawGamma}
                    onChange={(e) => setEditForm({ ...editForm, rawGamma: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">预测结论</label>
                <input
                  value={editForm.forecastConclusion}
                  onChange={(e) => setEditForm({ ...editForm, forecastConclusion: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  补录/修正理由 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  rows={3}
                  placeholder="必须填写。例如：复核手算反例后重新调整 alpha 至 70%，gamma 由 25% 修正为 0.3。"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <button
                onClick={closeEditDialog}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving || !editForm.reason.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                {editSaving ? '保存中...' : '保存新版本'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RawValueBadge({ value }: { value: string }) {
  const isPct = typeof value === 'string' && value.endsWith('%');
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium',
        isPct ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-50 text-slate-700 border border-slate-200'
      )}
    >
      {isPct && <span className="mr-1 opacity-70">%</span>}
      {value}
    </span>
  );
}

function StatusBadge({ record }: { record: ParameterRecord }) {
  if (record.hasMixedFormat) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        <AlertTriangle className="w-3 h-3 mr-1" />
        混合格式待复核
      </span>
    );
  }
  if (record.source === 'corrected') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        已修正 v{record.version}
      </span>
    );
  }
  if (record.source === 'overwritten') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
        重复覆盖 v{record.version}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
      正常
    </span>
  );
}
