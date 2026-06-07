import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { parseFile, downloadTemplate, formatCurrency } from '../utils/fileParser';
import { useRecordStore } from '../store/useRecordStore';
import type { ValuationRecord, FileParseResult } from '../types';

export const ImportPage = () => {
  const navigate = useNavigate();
  const addRecords = useRecordStore(state => state.addRecords);
  
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState<FileParseResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    setParseResult(null);
    const result = await parseFile(file);
    setParseResult(result);
  };

  const handleImport = async () => {
    if (!parseResult || !parseResult.success) return;
    
    setIsImporting(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    addRecords(parseResult.data as Partial<ValuationRecord>[]);
    
    setIsImporting(false);
    setImportSuccess(true);
    
    setTimeout(() => {
      navigate('/exceptions');
    }, 1500);
  };

  const resetImport = () => {
    setParseResult(null);
    setImportSuccess(false);
  };

  return (
    <Layout title="材料导入">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">导入估值材料</h2>
              <p className="text-sm text-gray-500 mt-1">支持 Excel (.xlsx, .xls) 和 CSV 格式</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-sm hover:bg-gray-50 transition-colors"
            >
              <Download size={14} />
              下载导入模板
            </button>
          </div>

          {!parseResult && !importSuccess && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-sm p-10 text-center transition-colors ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400 bg-gray-50'
              }`}
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-white border border-gray-200 rounded-sm flex items-center justify-center">
                <FileSpreadsheet size={32} className="text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                拖拽文件到此处，或
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-sm cursor-pointer hover:bg-blue-700 transition-colors">
                <Upload size={16} />
                选择文件
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-400 mt-3">
                单次最多支持 10000 条数据
              </p>
            </div>
          )}

          {parseResult && !importSuccess && (
            <div className="space-y-4">
              <div className={`p-4 rounded-sm flex items-start gap-3 ${
                parseResult.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                {parseResult.success ? (
                  <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-medium ${
                    parseResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {parseResult.success 
                      ? `文件解析成功，共 ${parseResult.data.length} 条数据` 
                      : '文件解析失败'}
                  </p>
                  {parseResult.errors && parseResult.errors.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {parseResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i} className="text-xs text-red-600">• {err}</li>
                      ))}
                      {parseResult.errors.length > 5 && (
                        <li className="text-xs text-red-500">...还有 {parseResult.errors.length - 5} 条错误</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {parseResult.success && parseResult.data.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">数据预览（前 10 条）</p>
                  <div className="overflow-x-auto border border-gray-200 rounded-sm">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left text-xs font-medium text-gray-500 py-2 px-3">交易编号</th>
                          <th className="text-left text-xs font-medium text-gray-500 py-2 px-3">交易对手</th>
                          <th className="text-left text-xs font-medium text-gray-500 py-2 px-3">产品类型</th>
                          <th className="text-right text-xs font-medium text-gray-500 py-2 px-3">名义本金</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.data.slice(0, 10).map((record, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="py-2 px-3 text-gray-900 font-mono">{record.tradeId}</td>
                            <td className="py-2 px-3 text-gray-900">{record.counterparty}</td>
                            <td className="py-2 px-3 text-gray-600">{record.productType}</td>
                            <td className="py-2 px-3 text-gray-900 text-right font-mono">
                              {record.notionalAmount ? formatCurrency(record.notionalAmount) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={resetImport}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-sm hover:bg-gray-50 transition-colors"
                >
                  重新选择
                </button>
                <button
                  onClick={handleImport}
                  disabled={!parseResult.success || isImporting}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isImporting ? '导入中...' : '确认导入'}
                </button>
              </div>
            </div>
          )}

          {importSuccess && (
            <div className="text-center py-10">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-2">导入成功</p>
              <p className="text-sm text-gray-500">
                共导入 {parseResult?.data.length || 0} 条记录，正在跳转到异常列表...
              </p>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">导入说明</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">1.</span>
              <span>请使用系统提供的标准模板，确保字段名称和格式正确</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">2.</span>
              <span>必填字段：交易编号、交易对手、产品类型、名义本金</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">3.</span>
              <span>可选字段：估值金额、估值版本、说明（将作为该版本的临时说明保存）</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">4.</span>
              <span>导入后系统将自动检测异常，可在异常列表中查看和处理</span>
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};
