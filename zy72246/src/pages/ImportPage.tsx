import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  XCircle,
  Download,
  Info,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppStore } from '@/store';
import { parseFile, generateSampleCSV } from '@/utils/fileParser';
import { processImportData } from '@/utils/deduplication';
import { checkReversalRule, generateBusinessKey } from '@/utils/boundaryRules';
import {
  ImportRowData,
  ImportResult,
  ImportDetail,
  ProcessingStatus,
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

  const resetState = useCallback(() => {
    setPageStep('upload');
    setParsedRows([]);
    setParseErrors([]);
    setImportResult(null);
    setImportDetails([]);
    setIsProcessing(false);
    setIsDragOver(false);
    setFileName('');
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

  const handleImport = useCallback(() => {
    setIsProcessing(true);

    const result = processImportData(taxNotes, parsedRows, currentUser);

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
  }, [taxNotes, parsedRows, currentUser, dispatch]);

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
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'SKIP':
        return <Info className="w-4 h-4 text-slate-400" />;
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
        return '重复';
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
              </div>
              <button
                onClick={handleImport}
                disabled={parsedRows.length === 0 || isProcessing}
                className={`px-6 py-2 rounded-lg text-white text-sm font-medium transition-colors ${
                  parsedRows.length === 0 || isProcessing
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
                        预计状态
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {parsedRows.map((row, idx) => {
                      const predicted = getPredictedStatus(row);
                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50 transition-colors ${
                            predicted.status === ProcessingStatus.REVERSAL_PENDING_REVIEW
                              ? 'bg-orange-50/50'
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
                            {predicted.label === '将更新' ? (
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
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-medium text-slate-700">导入明细</h3>
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
                        说明
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        记录ID
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
                        <td className="px-4 py-3 text-sm font-mono text-slate-500 max-w-xs truncate">
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
          </div>
        )}
      </div>
    </Layout>
  );
}
