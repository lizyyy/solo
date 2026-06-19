import { useState, useRef, useCallback, useMemo } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  XCircle,
  Download,
  Info,
  RefreshCw,
  ArrowRight,
  Merge,
  SkipForward,
  Edit3,
  Eye,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppStore } from '@/store';
import { parseFile, generateSampleCSV } from '@/utils/fileParser';
import { processImportData, analyzeDuplicates } from '@/utils/deduplication';
import { checkReversalRule, generateBusinessKey } from '@/utils/boundaryRules';
import {
  ImportRowData,
  ImportResult,
  ImportDetail,
  ProcessingStatus,
  DuplicateAction,
  DuplicateResolution,
} from '@/types';

type PageStep = 'upload' | 'preview' | 'result';

export default function ImportPage() {
  const { taxNotes, currentUser, dispatch } = useAppStore();
  const [pageStep, setPageStep] = useState<PageStep>('upload');
  const [parsedRows, setParsedRows] = useState<ImportRowData[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importDetails, setImportDetails] = useState<ImportDetail[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [duplicateResolutions, setDuplicateResolutions] = useState<Map<string, DuplicateResolution>>(new Map());

  const duplicateAnalysis = useMemo(() => {
    return analyzeDuplicates(taxNotes, parsedRows);
  }, [taxNotes, parsedRows]);

  const hasDuplicates = duplicateAnalysis.potentialDuplicates.length > 0;

  const allDuplicatesResolved = useMemo(() => {
    if (!hasDuplicates) return true;
    return duplicateAnalysis.potentialDuplicates.every((_, index) => {
      const key = `dup_${index}`;
      const resolution = duplicateResolutions.get(key);
      return resolution && resolution.action;
    });
  }, [hasDuplicates, duplicateAnalysis.potentialDuplicates, duplicateResolutions]);

  const resetState = useCallback(() => {
    setPageStep('upload');
    setParsedRows([]);
    setParseErrors([]);
    setImportResult(null);
    setImportDetails([]);
    setIsProcessing(false);
    setIsDragOver(false);
    setFileName('');
    setDuplicateResolutions(new Map());
  }, []);

  const handleFile = useCallback(async (file: File) => {
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(ext)) {
      setParseErrors(['不支持的文件格式，请上传 .csv / .xlsx / .xls 文件']);
      return;
    }

    setFileName(file.name);
    setParseErrors([]);

    const result = await parseFile(file);
    if (result.data.length === 0 && result.errors.length > 0) {
      setParseErrors(result.errors);
      setParsedRows([]);
      return;
    }

    setParsedRows(result.data);
    setParseErrors(result.errors);
    setPageStep('preview');
  }, []);

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [handleFile],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const getPredictedStatus = useCallback(
    (row: ImportRowData): { label: string; status: ProcessingStatus } => {
      const businessKey = generateBusinessKey(row.tradeDate, row.stockCode, row.serialNumber);
      const existing = taxNotes.find((n) => n.id === businessKey);
      if (existing) {
        return { label: '将更新', status: existing.processingStatus };
      }
      if (checkReversalRule(row.amount, row.remark)) {
        return { label: '已冲正待复核', status: ProcessingStatus.REVERSAL_PENDING_REVIEW };
      }
      return { label: '待处理', status: ProcessingStatus.PENDING };
    },
    [taxNotes],
  );

  const handleDuplicateActionChange = (dupIndex: number, action: DuplicateAction) => {
    const key = `dup_${dupIndex}`;
    const dup = duplicateAnalysis.potentialDuplicates[dupIndex];
    const newResolutions = new Map(duplicateResolutions);
    newResolutions.set(key, {
      rowIndex: dup.rowIndex,
      recordId: dup.existing.id,
      action,
    });
    setDuplicateResolutions(newResolutions);
  };

  const handleMergeRemarkChange = (dupIndex: number, remark: string) => {
    const key = `dup_${dupIndex}`;
    const existing = duplicateResolutions.get(key);
    if (existing) {
      const newResolutions = new Map(duplicateResolutions);
      newResolutions.set(key, { ...existing, mergeRemark: remark });
      setDuplicateResolutions(newResolutions);
    }
  };

  const buildResolutionArray = (): DuplicateResolution[] => {
    const resolutions: DuplicateResolution[] = [];
    duplicateAnalysis.potentialDuplicates.forEach((dup, index) => {
      const key = `dup_${index}`;
      const resolution = duplicateResolutions.get(key);
      if (resolution) {
        resolutions.push(resolution);
      }
    });
    return resolutions;
  };

  const handleImport = useCallback(() => {
    if (hasDuplicates && !allDuplicatesResolved) {
      alert('请先处理所有重复记录，选择更新、跳过或合并');
      return;
    }

    setIsProcessing(true);

    const resolutions = buildResolutionArray();
    const result = processImportData(taxNotes, parsedRows, currentUser, resolutions);

    dispatch({
      type: 'IMPORT_DATA',
      payload: {
        taxNotes: result.taxNotes,
        versions: result.versions,
        statusHistories: result.statusHistories,
      },
    });

    setImportResult(result.importResult);
    setImportDetails(result.importResult.details);
    setIsProcessing(false);
    setPageStep('result');
  }, [taxNotes, parsedRows, currentUser, dispatch, hasDuplicates, allDuplicatesResolved, duplicateAnalysis.potentialDuplicates, duplicateResolutions]);

  const handleDownloadSample = useCallback(() => {
    const csvContent = generateSampleCSV();
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '税费率备注导入模板.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const actionIcon = (action: ImportDetail['action']) => {
    switch (action) {
      case 'NEW':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'UPDATE':
        return <RefreshCw className="w-4 h-4 text-blue-600" />;
      case 'SKIP':
        return <SkipForward className="w-4 h-4 text-slate-400" />;
      case 'ERROR':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'DUPLICATE':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
    }
  };

  const actionLabel = (action: ImportDetail['action']) => {
    switch (action) {
      case 'NEW':
        return '新增';
      case 'UPDATE':
        return '更新';
      case 'SKIP':
        return '跳过';
      case 'ERROR':
        return '错误';
      case 'DUPLICATE':
        return '重复待处理';
    }
  };

  const actionColor = (action: ImportDetail['action']) => {
    switch (action) {
      case 'NEW':
        return 'bg-green-100 text-green-800';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800';
      case 'SKIP':
        return 'bg-slate-100 text-slate-600';
      case 'ERROR':
        return 'bg-red-100 text-red-800';
      case 'DUPLICATE':
        return 'bg-orange-100 text-orange-800';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="text-2xl font-bold text-slate-800"
              style={{ fontFamily: "'Noto Serif SC', serif" }}
            >
              税费率备注导入
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              上传 CSV / Excel 文件，系统自动解析并去重处理
            </p>
          </div>
          {pageStep !== 'upload' && (
            <button
              onClick={resetState}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors text-sm"
            >
              重新上传
            </button>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">导入规则说明</p>
            <ul className="mt-1 space-y-1 text-blue-700">
              <li>• 支持 .csv / .xlsx / .xls 格式，文件首行为表头</li>
              <li>• 必填列：交易日期、证券代码、流水号</li>
              <li>• 可选列：证券名称、税费金额、备注、柜台流水尾号</li>
              <li>• 重复判定：交易日期 + 证券代码 + 流水号 作为业务主键</li>
              <li>• 金额为 0 且备注含「冲正」的记录将自动标记为「已冲正待复核」</li>
              <li>• 重复记录可选择：更新（覆盖）、跳过（保留原记录）、合并（备注合并）</li>
            </ul>
          </div>
        </div>

        {pageStep === 'upload' && (
          <div className="space-y-6">
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              }`}
            >
              <Upload
                className={`w-12 h-12 mx-auto mb-4 ${
                  isDragOver ? 'text-blue-500' : 'text-slate-400'
                }`}
              />
              <p className="text-lg font-medium text-slate-700 mb-1">
                {isDragOver ? '松开鼠标上传文件' : '拖拽文件到此处，或点击选择文件'}
              </p>
              <p className="text-sm text-slate-500">
                支持 .csv / .xlsx / .xls 格式
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={onFileInputChange}
                className="hidden"
              />
            </div>

            <div className="flex items-center justify-center">
              <button
                onClick={handleDownloadSample}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors text-sm text-slate-700"
              >
                <Download className="w-4 h-4" />
                <span>下载示例文件</span>
              </button>
            </div>

            {parseErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium">文件解析错误</p>
                  <ul className="mt-1 space-y-1 text-red-700">
                    {parseErrors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {pageStep === 'preview' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                <span className="text-sm text-slate-700 font-medium">{fileName}</span>
                <span className="text-sm text-slate-500">
                  共 {parsedRows.length} 条记录
                </span>
                {hasDuplicates && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                    {duplicateAnalysis.potentialDuplicates.length} 条重复
                  </span>
                )}
              </div>
              <button
                onClick={handleImport}
                disabled={parsedRows.length === 0 || isProcessing || (hasDuplicates && !allDuplicatesResolved)}
                className={`px-6 py-2 rounded-lg text-white text-sm font-medium transition-colors ${
                  parsedRows.length === 0 || isProcessing || (hasDuplicates && !allDuplicatesResolved)
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isProcessing ? '处理中...' : '确认导入'}
              </button>
            </div>

            {parseErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium">部分行解析错误（已跳过）</p>
                  <ul className="mt-1 space-y-1 text-red-700">
                    {parseErrors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {hasDuplicates && (
              <div className="bg-orange-50 border border-orange-300 rounded-lg p-4">
                <div className="flex items-start space-x-3 mb-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-orange-800">
                      检测到 {duplicateAnalysis.potentialDuplicates.length} 条重复记录，请选择处理方式
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      业务主键：交易日期 + 证券代码 + 流水号
                    </p>
                  </div>
                  {!allDuplicatesResolved && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                      未全部处理
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {duplicateAnalysis.potentialDuplicates.map((dup, idx) => {
                    const key = `dup_${idx}`;
                    const resolution = duplicateResolutions.get(key);
                    const selectedAction = resolution?.action;

                    return (
                      <div
                        key={idx}
                        className="bg-white rounded-lg border border-orange-200 p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium text-slate-800">
                              {dup.row.stockCode} {dup.row.stockName}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              交易日期: {dup.row.tradeDate} · 流水号: {dup.row.serialNumber}
                            </p>
                            <p className="text-xs text-slate-500">
                              记录ID: <span className="font-mono">{dup.existing.id}</span>
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleDuplicateActionChange(idx, DuplicateAction.CONFIRM_UPDATE)}
                              className={`flex items-center space-x-1 px-3 py-1.5 text-xs rounded transition-colors ${
                                selectedAction === DuplicateAction.CONFIRM_UPDATE
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                              }`}
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>更新</span>
                            </button>
                            <button
                              onClick={() => handleDuplicateActionChange(idx, DuplicateAction.SKIP)}
                              className={`flex items-center space-x-1 px-3 py-1.5 text-xs rounded transition-colors ${
                                selectedAction === DuplicateAction.SKIP
                                  ? 'bg-slate-600 text-white'
                                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <SkipForward className="w-3 h-3" />
                              <span>跳过</span>
                            </button>
                            <button
                              onClick={() => handleDuplicateActionChange(idx, DuplicateAction.MERGE)}
                              className={`flex items-center space-x-1 px-3 py-1.5 text-xs rounded transition-colors ${
                                selectedAction === DuplicateAction.MERGE
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                              }`}
                            >
                              <Merge className="w-3 h-3" />
                              <span>合并</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="bg-slate-50 p-3 rounded">
                            <p className="text-xs text-slate-500 mb-1 font-medium">原有记录</p>
                            <p className="text-xs text-slate-400">金额: HK$ {dup.existing.currentAmount.toFixed(2)}</p>
                            <p className="text-xs text-slate-600 mt-1">备注: {dup.existing.currentRemark}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              尾号: {dup.existing.counterTailNumber || '-'}
                            </p>
                            <p className="text-xs mt-1">
                              <StatusBadge status={dup.existing.processingStatus} />
                            </p>
                          </div>
                          <div className="bg-blue-50 p-3 rounded">
                            <p className="text-xs text-blue-600 mb-1 font-medium">新导入</p>
                            <p className="text-xs text-slate-500">金额: HK$ {dup.row.amount.toFixed(2)}</p>
                            <p className="text-xs text-slate-700 mt-1">备注: {dup.row.remark}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              尾号: {dup.row.counterTailNumber || '-'}
                            </p>
                            <p className="text-xs mt-1">
                              {checkReversalRule(dup.row.amount, dup.row.remark) ? (
                                <StatusBadge status={ProcessingStatus.REVERSAL_PENDING_REVIEW} />
                              ) : (
                                <StatusBadge status={ProcessingStatus.PENDING} />
                              )}
                            </p>
                          </div>
                        </div>

                        {selectedAction === DuplicateAction.MERGE && (
                          <div className="mt-3 bg-purple-50 p-3 rounded">
                            <label className="block text-xs font-medium text-purple-700 mb-1">
                              合并说明（可选，将插入到两条备注之间）
                            </label>
                            <input
                              type="text"
                              value={resolution?.mergeRemark || ''}
                              onChange={(e) => handleMergeRemarkChange(idx, e.target.value)}
                              placeholder="如：2024-01-16补充导入"
                              className="w-full px-3 py-2 text-sm border border-purple-200 rounded focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-medium text-slate-700">数据预览</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        原始行号
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        交易日期
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        证券代码
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        证券名称
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        流水号
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        金额
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        备注
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        流水尾号
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        预计处理
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {parsedRows.map((row, idx) => {
                      const predicted = getPredictedStatus(row);
                      const isDup = duplicateAnalysis.potentialDuplicates.some(d => d.rowIndex === idx);
                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50 transition-colors ${
                            predicted.status === ProcessingStatus.REVERSAL_PENDING_REVIEW
                              ? 'bg-orange-50/50'
                              : isDup
                              ? 'bg-yellow-50/30'
                              : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-sm font-mono text-slate-800">
                            <span className="bg-slate-100 px-2 py-1 rounded">
                              {row.lineNumber}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-800">
                            {row.tradeDate}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-slate-800">
                            {row.stockCode}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-800">
                            {row.stockName}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-slate-800">
                            {row.serialNumber}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-slate-800">
                            HK$ {row.amount.toFixed(2)}
                          </td>
                          <td
                            className="px-4 py-3 text-sm text-slate-800 max-w-xs truncate"
                            title={row.remark}
                          >
                            {row.remark}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-slate-800">
                            {row.counterTailNumber || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {isDup ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border bg-orange-100 text-orange-800 border-orange-300">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                重复待处理
                              </span>
                            ) : predicted.label === '将更新' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border bg-blue-100 text-blue-800 border-blue-300">
                                将更新
                              </span>
                            ) : (
                              <StatusBadge status={predicted.status} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {parsedRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-12 text-center text-slate-500"
                        >
                          暂无可预览的数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {pageStep === 'result' && importResult && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800">导入完成</p>
                <p className="text-sm text-green-700">
                  共处理 {importResult.totalRecords} 条记录，新增 {importResult.newRecords} 条，更新 {importResult.updatedRecords} 条
                </p>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-4">
              <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm text-center">
                <p className="text-sm text-slate-500">总记录数</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">
                  {importResult.totalRecords}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 shadow-sm text-center">
                <p className="text-sm text-green-700">新增</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {importResult.newRecords}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 shadow-sm text-center">
                <p className="text-sm text-blue-700">更新</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  {importResult.updatedRecords}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 shadow-sm text-center">
                <p className="text-sm text-slate-500">跳过</p>
                <p className="text-3xl font-bold text-slate-600 mt-1">
                  {importResult.skippedRecords}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200 shadow-sm text-center">
                <p className="text-sm text-red-700">错误</p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {importResult.errorRecords}
                </p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 shadow-sm text-center">
                <p className="text-sm text-orange-700">待风控复核</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">
                  {importResult.reversalPendingRecords}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-700">导入明细</h3>
                <span className="text-xs text-slate-500">
                  共 {importDetails.length} 条
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        原始行号
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        处理结果
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        处理说明
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        记录编号
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {importDetails.map((detail, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-slate-800">
                          <span className="bg-slate-100 px-2 py-1 rounded">
                            {detail.lineNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded text-xs font-medium ${actionColor(
                              detail.action,
                            )}`}
                          >
                            {actionIcon(detail.action)}
                            <span>{actionLabel(detail.action)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {detail.reason}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-500 max-w-xs truncate" title={detail.recordId}>
                          {detail.recordId || '-'}
                        </td>
                      </tr>
                    ))}
                    {importDetails.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-12 text-center text-slate-500"
                        >
                          暂无导入明细
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={resetState}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors text-sm"
              >
                继续导入
              </button>
              <button
                onClick={() => window.location.hash = '#/'}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
              >
                <Eye className="w-4 h-4" />
                <span>查看记录列表</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
