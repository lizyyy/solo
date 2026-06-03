import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';
import { useClearingStore } from '@/store/useClearingStore';
import { api } from '@/services/api';
import StatusBadge from '@/components/common/StatusBadge';
import AmountDisplay from '@/components/common/AmountDisplay';
import { isZeroReversed } from '@shared/types';
import type { TailAdjustment, ImportResult } from '@shared/types';
import { sampleCsvData } from '@shared/mockData';

export default function ImportBoard() {
  const { addAdjustments, currentUser } = useClearingStore();
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<TailAdjustment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setImporting(true);
    setImportResult(null);
    setPreviewData(null);

    try {
      const result = await api.importFile(file);
      setImportResult(result);
      setPreviewData(result.items);
    } catch (e) {
      setError('文件解析失败，请检查文件格式是否正确');
    } finally {
      setImporting(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const confirmImport = () => {
    if (previewData) {
      addAdjustments(previewData);
      setPreviewData(null);
      setImportResult(null);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([sampleCsvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_import.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const flaggedCount = previewData?.filter((item) => isZeroReversed(item.amount, item.remark)).length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-carbon-800">数据导入</h1>
          <p className="text-carbon-500 mt-1">上传CSV或Excel文件，系统将自动检测异常记录</p>
        </div>
        <button
          onClick={downloadSample}
          className="px-4 py-2 text-sm text-custody-blue hover:text-custody-blue-hover transition-colors"
        >
          下载示例文件
        </button>
      </div>

      <div
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ${
          isDragging
            ? 'border-custody-blue bg-custody-blue-light/30'
            : 'border-carbon-200 bg-white hover:border-carbon-300'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {importing ? (
          <div className="py-8">
            <Loader2 className="w-16 h-16 text-custody-blue animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium text-carbon-700">正在解析文件...</p>
            <p className="text-sm text-carbon-400 mt-1">小周正在努力读取数据，请稍候～</p>
          </div>
        ) : error ? (
          <div className="py-8">
            <div className="w-16 h-16 bg-risk-red-light rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-risk-red" />
            </div>
            <p className="text-lg font-medium text-risk-red">导入失败</p>
            <p className="text-sm text-carbon-500 mt-1">{error}</p>
          </div>
        ) : importResult ? (
          <div className="py-4">
            <div className="w-16 h-16 bg-finance-green-light rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-finance-green" />
            </div>
            <p className="text-lg font-medium text-carbon-700">文件解析完成！</p>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-carbon-800">{importResult.total}</p>
                <p className="text-sm text-carbon-500">总记录数</p>
              </div>
              {flaggedCount > 0 && (
                <div className="text-center">
                  <p className="text-3xl font-bold text-risk-red">{flaggedCount}</p>
                  <p className="text-sm text-carbon-500">异常记录</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => {
                  setImportResult(null);
                  setPreviewData(null);
                }}
                className="px-6 py-2 border border-carbon-200 rounded-lg text-carbon-600 hover:bg-carbon-50 transition-colors"
              >
                重新上传
              </button>
              <button
                onClick={confirmImport}
                className="px-6 py-2 bg-carbon-600 text-white rounded-lg hover:bg-carbon-700 transition-colors"
              >
                确认导入
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isDragging ? 'bg-custody-blue' : 'bg-carbon-100'
            }`}>
              <Upload className={`w-10 h-10 ${isDragging ? 'text-white' : 'text-carbon-400'}`} />
            </div>
            <p className="text-lg font-medium text-carbon-700">
              {isDragging ? '释放鼠标上传文件' : '拖拽文件到此处'}
            </p>
            <p className="text-sm text-carbon-400 mt-1">支持 .csv, .xlsx, .xls 格式</p>
            <label className="inline-block mt-4 px-6 py-2 bg-custody-blue text-white rounded-lg hover:bg-custody-blue-hover transition-colors cursor-pointer">
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                选择文件
              </span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileInput}
              />
            </label>
          </>
        )}
      </div>

      {previewData && previewData.length > 0 && (
        <div className="bg-white rounded-xl shadow-card overflow-hidden animate-slide-up">
          <div className="p-4 border-b border-carbon-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-carbon-800">数据预览</h2>
              {flaggedCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-risk-red-light text-risk-red text-xs rounded-full">
                  <AlertCircle className="w-3 h-3" />
                  {flaggedCount} 条异常记录已标红
                </span>
              )}
            </div>
            <span className="text-sm text-carbon-400">共 {previewData.length} 条记录</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-carbon-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-carbon-500 uppercase tracking-wider">
                    交易日期
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-carbon-500 uppercase tracking-wider">
                    调整单号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-carbon-500 uppercase tracking-wider">
                    金额
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-carbon-500 uppercase tracking-wider">
                    备注
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-carbon-500 uppercase tracking-wider">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-carbon-100">
                {previewData.map((item, index) => {
                  const isFlagged = isZeroReversed(item.amount, item.remark);
                  return (
                    <tr
                      key={index}
                      className={`${
                        isFlagged
                          ? 'bg-risk-red-light/30 hover:bg-risk-red-light/50'
                          : 'hover:bg-carbon-50'
                      } transition-colors`}
                    >
                      <td className="px-4 py-3 text-sm text-carbon-700">
                        {item.tradeDate}
                        {isFlagged && <span className="ml-2 text-risk-red text-xs">⚠️</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-carbon-800">
                        {item.adjustmentNo}
                      </td>
                      <td className="px-4 py-3">
                        <AmountDisplay amount={item.amount} />
                      </td>
                      <td className="px-4 py-3 text-sm text-carbon-600">
                        {item.remark}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={item.status}
                          amount={item.amount}
                          remark={item.remark}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl p-6 shadow-card">
        <h3 className="font-semibold text-carbon-800 mb-3">📋 导入说明</h3>
        <ul className="space-y-2 text-sm text-carbon-600">
          <li className="flex items-start gap-2">
            <span className="text-finance-green">•</span>
            CSV文件需包含列：tradeDate, adjustmentNo, amount, remark
          </li>
          <li className="flex items-start gap-2">
            <span className="text-finance-green">•</span>
            金额为0且备注包含"已冲正"的记录将被标记为异常，需要风控复核
          </li>
          <li className="flex items-start gap-2">
            <span className="text-finance-green">•</span>
            异常记录需要先补录托管确认页，然后提交风控复核
          </li>
          <li className="flex items-start gap-2">
            <span className="text-warning-orange">⚠️</span>
            导入操作不可撤销，请确认数据无误后再提交
          </li>
        </ul>
      </div>
    </div>
  );
}
