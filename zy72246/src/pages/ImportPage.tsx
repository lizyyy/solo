import { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, Download, Info } from 'lucide-react';
import { parseFile, generateSampleCSV } from '@/utils/fileParser';
import { processImportData } from '@/utils/deduplication';
import { useAppStore } from '@/store';
import { ImportRowData, ImportResult, ImportDetail, ProcessingStatus } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { Layout } from '@/components/Layout';
import { getStatusDisplayName } from '@/utils/stateMachine';

export default function ImportPage() {
  const { taxNotes, currentUser, dispatch } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [parsedData, setParsedData] = useState<ImportRowData[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [imported, setImported] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    setFileName(file.name);
    setImported(false);
    setImportResult(null);

    const result = await parseFile(file);
    setParsedData(result.data);
    setParseErrors(result.errors);
  };

  const handleImport = () => {
    const result = processImportData(taxNotes, parsedData, currentUser);

    dispatch({
      type: 'IMPORT_DATA',
      payload: {
        taxNotes: result.taxNotes,
        versions: result.versions,
        statusHistories: result.statusHistories,
      },
    });

    setImportResult(result.importResult);
    setImported(true);
  };

  const downloadSampleCSV = () => {
    const csvContent = generateSampleCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '税费率备注示例.csv';
    link.click();
  };

  const getActionColor = (action: ImportDetail['action']) => {
    switch (action) {
      case 'NEW': return 'text-green-600 bg-green-50';
      case 'UPDATE': return 'text-blue-600 bg-blue-50';
      case 'SKIP': return 'text-gray-600 bg-gray-50';
      case 'ERROR': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getActionLabel = (action: ImportDetail['action']) => {
    switch (action) {
      case 'NEW': return '新增';
      case 'UPDATE': return '更新';
      case 'SKIP': return '跳过';
      case 'ERROR': return '错误';
      default: return action;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800" style={{ fontFamily: "'Noto Serif SC', serif" }}>
            导入税费率备注
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            支持 CSV 和 Excel 格式，系统将自动去重并保留原始行号
          </p>
        </div>
        <button
          onClick={downloadSampleCSV}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>下载示例文件</span>
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">导入规则说明</p>
          <ul className="mt-1 space-y-1 text-blue-700">
            <li>• 系统基于「交易日期 + 证券代码 + 流水号」作为业务主键判断重复</li>
            <li>• 重复导入时，仅更新有变更的字段，并创建新版本记录</li>
            <li>• 金额为0且备注含「冲正」的记录，将自动标记为「已冲正待复核」，需风控同事处理</li>
            <li>• 原始行号、原始备注将永久保留，不可修改</li>
          </ul>
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
        }`}
      >
        <input
          type="file"
          id="file-upload"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center space-y-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isDragging ? 'bg-blue-100' : 'bg-slate-100'
            }`}>
              <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className="text-lg font-medium text-slate-700">
                {isDragging ? '松开以上传文件' : '拖拽文件到此处，或点击选择'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                支持 .csv, .xlsx, .xls 格式
              </p>
            </div>
          </div>
        </label>
      </div>

      {fileName && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileSpreadsheet className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-medium text-slate-800">{fileName}</p>
              <p className="text-sm text-slate-500">
                解析完成: {parsedData.length} 条数据
                {parseErrors.length > 0 && ` · ${parseErrors.length} 条错误`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {parseErrors.length > 0 && (
              <div className="flex items-center space-x-1 text-amber-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">有解析错误</span>
              </div>
            )}
            {!imported && parsedData.length > 0 && (
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                确认导入
              </button>
            )}
          </div>
        </div>
      )}

      {parseErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-800 mb-2 flex items-center space-x-2">
            <XCircle className="w-4 h-4" />
            <span>解析错误</span>
          </h3>
          <ul className="text-sm text-red-700 space-y-1">
            {parseErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {importResult && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-medium text-slate-800 flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>导入完成</span>
            </h3>
          </div>
          <div className="p-4 grid grid-cols-6 gap-4">
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-800">{importResult.totalRecords}</p>
              <p className="text-xs text-slate-500">总记录数</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{importResult.newRecords}</p>
              <p className="text-xs text-slate-500">新增</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{importResult.updatedRecords}</p>
              <p className="text-xs text-slate-500">更新</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-600">{importResult.skippedRecords}</p>
              <p className="text-xs text-slate-500">跳过</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{importResult.errorRecords}</p>
              <p className="text-xs text-slate-500">错误</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{importResult.reversalPendingRecords}</p>
              <p className="text-xs text-slate-500">待风控复核</p>
            </div>
          </div>
          <div className="p-4 border-t border-slate-200">
            <h4 className="text-sm font-medium text-slate-700 mb-3">详细记录</h4>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">原始行号</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">证券代码</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">操作</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importResult.details.map((detail, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-slate-800">{detail.lineNumber}</td>
                      <td className="px-3 py-2 font-mono text-slate-800">
                        {parsedData[index]?.stockCode || '-'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(detail.action)}`}>
                          {getActionLabel(detail.action)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{detail.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {parsedData.length > 0 && !imported && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-medium text-slate-800">数据预览</h3>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">原始行号</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">交易日期</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">证券代码</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">证券名称</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">流水号</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">金额</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">备注</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">流水尾号</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">预计状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedData.map((row, index) => {
                  const existing = taxNotes.find(t => t.id === `${row.tradeDate}_${row.stockCode}_${row.serialNumber}`);
                  const isReversal = row.amount === 0 && row.remark.includes('冲正');

                  return (
                    <tr key={index} className={`hover:bg-slate-50 ${isReversal ? 'bg-orange-50/50' : ''}`}>
                      <td className="px-3 py-2 font-mono text-slate-800">{row.lineNumber}</td>
                      <td className="px-3 py-2 text-slate-800">{row.tradeDate}</td>
                      <td className="px-3 py-2 font-mono text-slate-800">{row.stockCode}</td>
                      <td className="px-3 py-2 text-slate-800">{row.stockName}</td>
                      <td className="px-3 py-2 font-mono text-slate-800">{row.serialNumber}</td>
                      <td className="px-3 py-2 font-mono text-slate-800">HK$ {row.amount.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-800 max-w-xs truncate" title={row.remark}>
                        {row.remark}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-800">{row.counterTailNumber || '-'}</td>
                      <td className="px-3 py-2">
                        {existing ? (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            将更新 (v{existing.version} → v{existing.version + 1})
                          </span>
                        ) : isReversal ? (
                          <StatusBadge status={ProcessingStatus.REVERSAL_PENDING_REVIEW} className="text-xs" />
                        ) : (
                          <StatusBadge status={ProcessingStatus.PENDING} className="text-xs" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </Layout>
  );
}
