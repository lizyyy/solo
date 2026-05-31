import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FileDown, CheckCircle, AlertTriangle, FileSpreadsheet, FileText, Settings, Loader2 } from 'lucide-react';
import { useExperiments } from '@/hooks/useExperiments';
import { useExport } from '@/hooks/useExport';
import { DataTable } from '@/components/DataTable';
import { ExperimentStatusBadge } from '@/components/StatusBadge';
import { formatDate, formatDateTime } from '@/utils/date';
import type { Experiment } from '@/types';
import type { ExportOptions } from '@/utils/export';

export function ExportCenter() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const experimentId = searchParams.get('id');

  const { experiments, getExperimentById, getStepRecordsByExperimentId, getScoreSheetByExperimentId, getAnomaliesByExperimentId, getScriptVersionsByExperimentId } = useExperiments();

  const [selectedExperiments, setSelectedExperiments] = useState<string[]>(
    experimentId ? [experimentId] : []
  );
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeAnomalies: true,
    includeVersionHistory: true,
    includeSourceMarks: true,
  });
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');

  const firstSelectedExp = selectedExperiments.length > 0
    ? getExperimentById(selectedExperiments[0])
    : undefined;

  const stepRecords = firstSelectedExp ? getStepRecordsByExperimentId(firstSelectedExp.id) : [];
  const scoreSheet = firstSelectedExp ? getScoreSheetByExperimentId(firstSelectedExp.id) : undefined;
  const anomalies = firstSelectedExp ? getAnomaliesByExperimentId(firstSelectedExp.id) : [];
  const scriptVersions = firstSelectedExp ? getScriptVersionsByExperimentId(firstSelectedExp.id) : [];

  const { isExporting, consistencyResult, runConsistencyCheck, handleExportExcel } = useExport(
    firstSelectedExp,
    stepRecords,
    scoreSheet,
    anomalies,
    scriptVersions
  );

  useEffect(() => {
    if (selectedExperiments.length > 0) {
      runConsistencyCheck();
    }
  }, [selectedExperiments, runConsistencyCheck]);

  const toggleExperiment = (id: string) => {
    setSelectedExperiments((prev) =>
      prev.includes(id)
        ? prev.filter((e) => e !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedExperiments.length === experiments.length) {
      setSelectedExperiments([]);
    } else {
      setSelectedExperiments(experiments.map((e) => e.id));
    }
  };

  const handleExport = async () => {
    if (selectedExperiments.length === 0) return;

    for (const id of selectedExperiments) {
      const exp = getExperimentById(id);
      const steps = getStepRecordsByExperimentId(id);
      const score = getScoreSheetByExperimentId(id);
      const anom = getAnomaliesByExperimentId(id);
      const scripts = getScriptVersionsByExperimentId(id);

      if (exportFormat === 'excel') {
        const { handleExportExcel } = useExport.getState?.() || {};
        if (handleExportExcel) {
          await handleExportExcel(exportOptions);
        } else {
          await handleExportExcel(exportOptions);
        }
      }
    }
  };

  const columns = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={selectedExperiments.length === experiments.length && experiments.length > 0}
          onChange={handleSelectAll}
          className="rounded border-neutral-300 text-primary focus:ring-primary"
        />
      ),
      width: '40px',
      render: (item: Experiment) => (
        <input
          type="checkbox"
          checked={selectedExperiments.includes(item.id)}
          onChange={(e) => {
            e.stopPropagation();
            toggleExperiment(item.id);
          }}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-neutral-300 text-primary focus:ring-primary"
        />
      ),
    },
    {
      key: 'experimentDate',
      header: '日期',
      width: '110px',
      render: (item: Experiment) => (
        <div className="font-mono text-sm">{formatDate(item.experimentDate)}</div>
      ),
    },
    {
      key: 'className',
      header: '班级',
      width: '140px',
    },
    {
      key: 'studentName',
      header: '学生',
      width: '100px',
      render: (item: Experiment) => (
        <div>
          <div className="font-medium">{item.studentName}</div>
          <div className="text-xs text-neutral-500 font-mono">{item.studentId}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: '120px',
      render: (item: Experiment) => <ExperimentStatusBadge status={item.status} />,
    },
    {
      key: 'summary',
      header: '数据摘要',
      render: (item: Experiment) => (
        <div className="text-xs text-neutral-600">
          <span>异常 {item.anomalyCount}</span>
          <span className="mx-2">·</span>
          <span>待补 {item.pendingCount}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6" id="export-content">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-mono font-semibold text-neutral-900">导出中心</h2>
        <div className="text-sm text-neutral-500">
          已选择 <span className="font-mono font-semibold text-primary">{selectedExperiments.length}</span> 条记录
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings size={16} className="text-neutral-500" />
            <span className="text-sm font-medium text-neutral-700">导出选项</span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-neutral-600 mb-2">导出格式</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setExportFormat('excel')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 border rounded text-sm transition-colors ${
                    exportFormat === 'excel'
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <FileSpreadsheet size={16} />
                  Excel
                </button>
                <button
                  onClick={() => setExportFormat('pdf')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 border rounded text-sm transition-colors ${
                    exportFormat === 'pdf'
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <FileText size={16} />
                  PDF
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeAnomalies}
                  onChange={(e) => setExportOptions({ ...exportOptions, includeAnomalies: e.target.checked })}
                  className="rounded border-neutral-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-neutral-700">包含异常说明</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeVersionHistory}
                  onChange={(e) => setExportOptions({ ...exportOptions, includeVersionHistory: e.target.checked })}
                  className="rounded border-neutral-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-neutral-700">包含版本历史</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportOptions.includeSourceMarks}
                  onChange={(e) => setExportOptions({ ...exportOptions, includeSourceMarks: e.target.checked })}
                  className="rounded border-neutral-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-neutral-700">包含数据来源标记</span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-neutral-500" />
            <span className="text-sm font-medium text-neutral-700">一致性校验</span>
          </div>

          {selectedExperiments.length === 0 ? (
            <div className="text-center py-4 text-sm text-neutral-500">
              请选择需要导出的实验记录
            </div>
          ) : consistencyResult ? (
            <div className="space-y-3">
              <div className={`p-3 rounded border ${
                consistencyResult.passed
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {consistencyResult.passed ? (
                    <CheckCircle size={16} className="text-green-600" />
                  ) : (
                    <AlertTriangle size={16} className="text-red-600" />
                  )}
                  <span className={`font-medium text-sm ${
                    consistencyResult.passed ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {consistencyResult.passed ? '数据一致性校验通过' : '发现数据一致性问题'}
                  </span>
                </div>
              </div>

              {consistencyResult.issues.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {consistencyResult.issues.map((issue, index) => (
                    <div
                      key={index}
                      className={`text-xs p-2 rounded ${
                        issue.severity === 'error'
                          ? 'bg-red-50 text-red-700'
                          : issue.severity === 'warning'
                          ? 'bg-orange-50 text-orange-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      <span className="font-medium uppercase">[{issue.severity}]</span> {issue.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          )}
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileDown size={16} className="text-neutral-500" />
            <span className="text-sm font-medium text-neutral-700">导出预览</span>
          </div>

          {selectedExperiments.length === 0 ? (
            <div className="text-center py-4 text-sm text-neutral-500">
              请选择需要导出的实验记录
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-neutral-700">
                将导出以下内容：
              </div>
              <ul className="text-xs text-neutral-600 space-y-1">
                <li className="flex items-center gap-1">
                  <CheckCircle size={12} className="text-green-500" />
                  实验基本信息
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle size={12} className="text-green-500" />
                  学生操作记录
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle size={12} className="text-green-500" />
                  评分表及结论
                </li>
                {exportOptions.includeAnomalies && (
                  <li className="flex items-center gap-1">
                    <CheckCircle size={12} className="text-green-500" />
                    异常说明记录
                  </li>
                )}
                {exportOptions.includeVersionHistory && (
                  <li className="flex items-center gap-1">
                    <CheckCircle size={12} className="text-green-500" />
                    脚本版本历史
                  </li>
                )}
                {exportOptions.includeSourceMarks && (
                  <li className="flex items-center gap-1">
                    <CheckCircle size={12} className="text-green-500" />
                    数据来源标记
                  </li>
                )}
              </ul>

              {firstSelectedExp && (
                <div className="mt-3 pt-3 border-t border-neutral-100">
                  <div className="text-xs text-neutral-500 mb-1">文件名示例</div>
                  <div className="font-mono text-xs text-primary">
                    桥梁实验_{firstSelectedExp.studentName}_{formatDate(firstSelectedExp.experimentDate)}.{exportFormat}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-neutral-700">选择导出记录</div>
          <div className="text-xs text-neutral-500">
            点击行可查看详情
          </div>
        </div>

        <DataTable
          columns={columns}
          data={experiments}
          onRowClick={(item) => navigate(`/experiments/${item.id}`)}
          emptyMessage="暂无实验记录"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => setSelectedExperiments([])}
          className="px-4 py-2 text-sm border border-neutral-300 rounded text-neutral-600 hover:bg-neutral-50 transition-colors"
        >
          清空选择
        </button>
        <button
          onClick={handleExport}
          disabled={selectedExperiments.length === 0 || isExporting}
          className="flex items-center gap-2 px-6 py-2 text-sm bg-primary text-white rounded hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FileDown size={16} />
          )}
          {isExporting ? '导出中...' : '开始导出'}
        </button>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="text-sm font-medium text-neutral-700 mb-3">导出说明</div>
        <div className="space-y-2 text-xs text-neutral-600">
          <p>• <strong>Excel导出</strong>：多Sheet格式，包含汇总、学生记录、评分表、异常记录、版本历史等</p>
          <p>• <strong>PDF导出</strong>：保留页面所有格式标记，适合打印存档</p>
          <p>• <strong>数据来源标记</strong>：导出文件中每条数据前标注 `[学生记录]`/`[评分表]`/`[补录]`</p>
          <p>• <strong>一致性校验</strong>：导出前自动校验数据一致性，异常项会在报告中列出</p>
          <p>• <strong>教研负责人说明</strong>：导出报告第一页包含数据来源说明和一致性校验结果，方便向教研负责人解释</p>
        </div>
      </div>
    </div>
  );
}
