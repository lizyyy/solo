import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import StatusBadge from '../components/StatusBadge';
import {
  FileDown,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  FileText,
  Clock,
  Hash,
  CheckSquare,
} from 'lucide-react';

export default function ExportManagement() {
  const {
    inspections,
    exportRecords,
    consistencyCheckResult,
    loading,
    error,
    selectedInspectionIds,
    fetchInspections,
    fetchExportRecords,
    performConsistencyCheck,
    createExport,
    downloadExport,
    clearSelection,
  } = useStore();

  const [selectedTemplate, setSelectedTemplate] = useState<'standard' | 'detailed'>('standard');
  const [autoCheck, setAutoCheck] = useState(true);

  useEffect(() => {
    fetchInspections();
    fetchExportRecords();

    const saved = sessionStorage.getItem('exportSelectedIds');
    if (saved) {
      try {
        const ids = JSON.parse(saved);
        if (ids.length > 0 && selectedInspectionIds.length === 0) {
          ids.forEach((id: string) => {
            if (!selectedInspectionIds.includes(id)) {
              // 会在store中处理
            }
          });
        }
      } catch (e) {}
      sessionStorage.removeItem('exportSelectedIds');
    }
  }, [fetchInspections, fetchExportRecords]);

  const exportableInspections = useMemo(() => {
    return inspections.filter((i) => selectedInspectionIds.includes(i.id));
  }, [inspections, selectedInspectionIds]);

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN');
  };

  const handleCheck = async () => {
    if (selectedInspectionIds.length === 0) return;
    await performConsistencyCheck(selectedInspectionIds);
  };

  const handleExport = async () => {
    if (selectedInspectionIds.length === 0) return;
    await createExport(selectedInspectionIds, selectedTemplate, autoCheck);
    clearSelection();
  };

  const getSeverityIcon = (severity: 'warning' | 'error') => {
    return severity === 'error' ? (
      <XCircle size={14} className="text-red-500" />
    ) : (
      <AlertTriangle size={14} className="text-amber-500" />
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">导出管理</h1>
        <p className="text-slate-600 mt-1">导出前一致性复核，确保巡检单数据准确无误</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border-2 border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <CheckSquare size={18} className="text-primary-600" />
            待导出记录
            <span className="ml-2 px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs">
              {selectedInspectionIds.length} 条
            </span>
          </h3>

          {selectedInspectionIds.length === 0 ? (
            <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
              <FileText size={36} className="mx-auto text-slate-300 mb-2" />
              <p>暂无待导出记录</p>
              <p className="text-xs text-slate-400 mt-1">请在检查工作台选择记录后点击「批量导出」</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {exportableInspections.map((inspection) => (
                <div
                  key={inspection.id}
                  className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-700">{inspection.name}</span>
                    <span className="text-xs text-slate-400 font-mono">
                      {inspection.rampNumber}
                    </span>
                  </div>
                  <StatusBadge status={inspection.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border-2 border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <FileDown size={18} className="text-primary-600" />
            导出设置
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">导出模板</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedTemplate('standard')}
                  className={`flex-1 py-2 px-4 rounded border-2 text-sm font-medium transition-colors ${
                    selectedTemplate === 'standard'
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  标准模板
                </button>
                <button
                  onClick={() => setSelectedTemplate('detailed')}
                  className={`flex-1 py-2 px-4 rounded border-2 text-sm font-medium transition-colors ${
                    selectedTemplate === 'detailed'
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  详细模板
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoCheck"
                checked={autoCheck}
                onChange={(e) => setAutoCheck(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
              />
              <label htmlFor="autoCheck" className="text-sm text-slate-700">
                导出前自动执行一致性校验
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCheck}
                disabled={loading || selectedInspectionIds.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-4 bg-white text-primary-700 rounded border-2 border-primary-300 hover:bg-primary-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <CheckCircle size={16} />
                )}
                执行一致性校验
              </button>
              <button
                onClick={handleExport}
                disabled={loading || selectedInspectionIds.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-4 bg-primary-600 text-white rounded border-2 border-primary-700 hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <FileDown size={16} />
                )}
                生成导出
              </button>
            </div>
          </div>
        </div>
      </div>

      {consistencyCheckResult && (
        <div
          className={`mb-6 border-2 rounded-lg p-4 ${
            consistencyCheckResult.passed
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            {consistencyCheckResult.passed ? (
              <CheckCircle size={20} className="text-green-600" />
            ) : (
              <XCircle size={20} className="text-red-600" />
            )}
            <span
              className={`font-semibold ${
                consistencyCheckResult.passed ? 'text-green-800' : 'text-red-800'
              }`}
            >
              一致性校验{consistencyCheckResult.passed ? '通过' : '未通过'}
            </span>
            <span className="text-sm text-slate-500 ml-auto">
              共检查 {consistencyCheckResult.totalItems} 条记录
            </span>
          </div>

          {consistencyCheckResult.issues.length > 0 && (
            <div className="space-y-2">
              {consistencyCheckResult.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 py-2 px-3 rounded ${
                    issue.severity === 'error' ? 'bg-red-100' : 'bg-amber-100'
                  }`}
                >
                  {getSeverityIcon(issue.severity)}
                  <span className="text-sm font-mono text-slate-600">
                    {issue.inspectionId}
                  </span>
                  <span className="text-xs text-slate-500">[{issue.field}]</span>
                  <span
                    className={`text-sm ${
                      issue.severity === 'error' ? 'text-red-700' : 'text-amber-700'
                    }`}
                  >
                    {issue.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          {consistencyCheckResult.issues.length === 0 && (
            <p className="text-sm text-green-700">
              所有记录数据完整、状态与变更记录匹配，可安全导出
            </p>
          )}
        </div>
      )}

      <div className="bg-white border-2 border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b-2 border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FileText size={18} className="text-primary-600" />
            导出历史
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  导出ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  模板
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  记录数
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  一致性校验
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  导出人
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  导出时间
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  文件哈希
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exportRecords.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-mono text-slate-700">
                    <span className="flex items-center gap-1">
                      <Hash size={12} />
                      {record.id}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {record.template === 'standard' ? '标准模板' : '详细模板'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {record.inspectionIds.length} 条
                  </td>
                  <td className="px-4 py-3">
                    {record.consistencyCheck.passed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-medium">
                        <CheckCircle size={12} />
                        通过
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-medium">
                        <XCircle size={12} />
                        未通过
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{record.exportedBy}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDateTime(record.exportedAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-400">
                    {record.fileHash.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => downloadExport(record.id)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-primary-600 hover:text-primary-800 text-sm font-medium"
                    >
                      <FileDown size={14} />
                      下载
                    </button>
                  </td>
                </tr>
              ))}

              {exportRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <FileText size={36} className="mx-auto text-slate-300 mb-2" />
                    <p>暂无导出记录</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 bg-slate-50 border-2 border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">导出前复核步骤</h3>
        <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
          <li>在检查工作台勾选需要导出的记录，点击「批量导出」</li>
          <li>在导出管理页选择导出模板（标准/详细）</li>
          <li>点击「执行一致性校验」，检查数据完整性和状态匹配</li>
          <li>若校验未通过，根据问题列表修正对应记录</li>
          <li>校验通过后，点击「生成导出」，在历史记录中下载文件</li>
          <li>文件哈希用于验证导出内容的一致性，防止篡改</li>
        </ol>
      </div>
    </div>
  );
}
