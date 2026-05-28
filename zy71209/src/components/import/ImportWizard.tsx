import { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Download, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { IMPORT_TEMPLATES, generateImportTemplate, downloadReport } from '../../utils/excel';
import type { ImportDataType, ImportResult } from '../../types';

const dataTypeLabels: Record<ImportDataType, { label: string; description: string; icon: string }> = {
  customer: { label: '客户账户', description: '导入客户基本信息', icon: '👤' },
  pledge: { label: '质押合约', description: '导入股票质押合约信息', icon: '📋' },
  market: { label: '行情数据', description: '导入股票最新行情和交易状态', icon: '📈' },
  warningLine: { label: '警戒线', description: '导入或更新警戒线设置', icon: '🚨' },
  supplement: { label: '补仓记录', description: '导入客户补仓记录', icon: '💰' },
  disposal: { label: '处置报告', description: '导入平仓处置报告', icon: '📄' },
};

interface ImportWizardProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function ImportWizard({ onClose, onSuccess }: ImportWizardProps) {
  const importData = useAppStore((state) => state.importData);
  const [step, setStep] = useState<'select' | 'upload' | 'preview' | 'result'>('select');
  const [selectedType, setSelectedType] = useState<ImportDataType | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTypeSelect = (type: ImportDataType) => {
    setSelectedType(type);
    setStep('upload');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handlePreview = async () => {
    if (!selectedType || !selectedFile) return;
    setLoading(true);
    try {
      const result = await importData(selectedType, selectedFile);
      setImportResult(result);
      setStep('result');
      onSuccess?.();
    } catch (error) {
      console.error('导入失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    if (!selectedType) return;
    const blob = generateImportTemplate(selectedType);
    downloadReport(blob, `导入模板_${dataTypeLabels[selectedType].label}.xlsx`);
  };

  const handleReset = () => {
    setStep('select');
    setSelectedType(null);
    setSelectedFile(null);
    setImportResult(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">数据导入</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-gray-600 mb-6">请选择要导入的数据类型</p>
              <div className="grid grid-cols-2 gap-4">
                {(Object.keys(dataTypeLabels) as ImportDataType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleTypeSelect(type)}
                    className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:border-[#1e3a5f] hover:bg-[#1e3a5f]/5 transition-all text-left group"
                  >
                    <span className="text-2xl">{dataTypeLabels[type].icon}</span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 group-hover:text-[#1e3a5f]">
                        {dataTypeLabels[type].label}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {dataTypeLabels[type].description}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-[#1e3a5f] transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'upload' && selectedType && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <button
                  onClick={() => setStep('select')}
                  className="text-[#1e3a5f] hover:underline"
                >
                  选择数据类型
                </button>
                <ArrowRight className="w-4 h-4" />
                <span className="text-gray-900 font-medium">
                  {dataTypeLabels[selectedType].label}
                </span>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  selectedFile
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-[#1e3a5f] hover:bg-[#1e3a5f]/5'
                }`}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer block">
                  {selectedFile ? (
                    <div className="space-y-2">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                      <div className="font-medium text-green-800">{selectedFile.name}</div>
                      <div className="text-sm text-green-600">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                      <div className="font-medium text-gray-700">
                        点击或拖拽文件到此处上传
                      </div>
                      <div className="text-sm text-gray-500">
                        支持 .xlsx, .xls 格式
                      </div>
                    </div>
                  )}
                </label>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">导入模板</span>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-1 text-sm text-[#1e3a5f] hover:underline"
                  >
                    <Download className="w-4 h-4" />
                    下载模板
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  必填字段：
                  {IMPORT_TEMPLATES[selectedType].required.join('、')}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  所有字段：
                  {IMPORT_TEMPLATES[selectedType].headers.join('、')}
                </div>
              </div>
            </div>
          )}

          {step === 'result' && importResult && (
            <div className="space-y-6">
              <div className={`p-6 rounded-lg text-center ${
                importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                {importResult.success ? (
                  <>
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h4 className="text-xl font-semibold text-green-800 mb-2">导入成功</h4>
                    <p className="text-green-600">
                      共 {importResult.total} 条，成功导入 {importResult.imported} 条
                    </p>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h4 className="text-xl font-semibold text-red-800 mb-2">导入失败</h4>
                    <p className="text-red-600">
                      发现 {importResult.errors.length} 个错误，请修正后重新导入
                    </p>
                  </>
                )}
              </div>

              {importResult.warnings.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium text-yellow-800">警告信息</span>
                  </div>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {importResult.warnings.slice(0, 5).map((w, i) => (
                      <li key={i}>第 {w.row} 行：{w.message}</li>
                    ))}
                    {importResult.warnings.length > 5 && (
                      <li>...还有 {importResult.warnings.length - 5} 条警告</li>
                    )}
                  </ul>
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-800">错误信息</span>
                  </div>
                  <ul className="text-sm text-red-700 space-y-1">
                    {importResult.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>第 {e.row} 行 [{e.field}]：{e.message}</li>
                    ))}
                    {importResult.errors.length > 10 && (
                      <li>...还有 {importResult.errors.length - 10} 条错误</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-800">
                  <span className="font-medium">💡 提示：</span>
                  导入数据已自动更新特殊场景标记（停牌估值、补仓未到账、展期旧任务等），
                  请前往预警名单查看最新状态。
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          {step === 'upload' && (
            <>
              <button
                onClick={() => setStep('select')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                上一步
              </button>
              <button
                onClick={handlePreview}
                disabled={!selectedFile || loading}
                className="px-6 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#1e3a5f]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    导入中...
                  </>
                ) : (
                  '开始导入'
                )}
              </button>
            </>
          )}

          {step === 'result' && (
            <>
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                继续导入
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#1e3a5f]/90 transition-colors"
              >
                完成
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
