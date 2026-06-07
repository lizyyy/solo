import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  Download,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { ImportPreviewResult } from '../../shared/types';
import api from '../lib/apiClient';

export const ImportPage: React.FC = () => {
  const {
    previewImport,
    executeImport,
    importBatches,
    fetchImportBatches,
    loading,
    addNotification,
  } = useAppStore();

  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchImportBatches();
  }, [fetchImportBatches]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setFileName(file.name);

    const text = await file.text();
    setFileContent(text);

    try {
      const result = await previewImport(text, 'csv');
      setPreview(result);
      setStep('preview');
    } catch (e) {
      // error handled by store
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleConfirmImport = async () => {
    if (!fileContent) return;
    try {
      await executeImport(fileContent, 'csv', fileName);
      setStep('done');
    } catch (e) {
      // error handled by store
    }
  };

  const resetForm = () => {
    setStep('upload');
    setPreview(null);
    setFileContent('');
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadSample = () => {
    const link = document.createElement('a');
    link.href = api.import.sampleCsv();
    link.download = 'sample_bus_card_times.csv';
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-stone-200 shadow-sm">
          <div className="px-6 py-4 border-b border-stone-200">
            <h3 className="font-bold text-stone-800">批量导入公交刷卡时段</h3>
            <p className="text-sm text-stone-500 mt-1">
              系统自动检测重复数据，不会把数量翻倍
            </p>
          </div>

          <div className="p-6">
            {step === 'upload' && (
              <>
                <div
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                    dragActive
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-stone-300 hover:border-emerald-400'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                  <Upload className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                  <div className="text-stone-700 font-medium mb-2">
                    拖拽 CSV 文件到这里，或
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-emerald-600 hover:underline mx-1"
                    >
                      点击选择文件
                    </button>
                  </div>
                  <div className="text-sm text-stone-400">
                    仅支持 CSV 格式，可先下载样例查看格式
                  </div>
                </div>

                <div className="mt-4 flex justify-center">
                  <button
                    onClick={downloadSample}
                    className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    <Download className="w-4 h-4" />
                    下载 CSV 样例文件
                  </button>
                </div>
              </>
            )}

            {step === 'preview' && preview && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-stone-800">{fileName}</div>
                    <div className="text-sm text-stone-500">
                      共 {preview.totalCount} 条记录，{preview.duplicateCount} 条重复已标记跳过
                    </div>
                  </div>
                  <button
                    onClick={resetForm}
                    className="text-sm text-stone-500 hover:text-stone-700"
                  >
                    重新选择
                  </button>
                </div>

                {preview.newBreakpoints.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-blue-900">将新增 {preview.newBreakpoints.length} 个断点</div>
                        <div className="text-sm text-blue-700 mt-1">
                          {preview.newBreakpoints.join('、')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {preview.duplicateCount > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-amber-900">
                          检测到 {preview.duplicateCount} 条重复数据
                        </div>
                        <div className="text-sm text-amber-700 mt-1">
                          同一断点同一时段同一日期的数据已存在，系统将自动跳过，不会重复计数
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto max-h-64 border border-stone-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">断点</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">时段</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">日期</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">客流量</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-stone-500">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {preview.items.map((item, i) => (
                        <tr key={i} className="hover:bg-stone-50">
                          <td className="px-4 py-2 text-stone-700">{item.breakpointName}</td>
                          <td className="px-4 py-2 text-stone-700">{item.timeSlot}</td>
                          <td className="px-4 py-2 text-stone-700">{item.sourceDate}</td>
                          <td className="px-4 py-2 text-stone-700">{item.passengerCount}</td>
                          <td className="px-4 py-2">
                            <span className="text-green-600 text-xs font-medium">新增</span>
                          </td>
                        </tr>
                      ))}
                      {preview.duplicates.map((item, i) => (
                        <tr key={`d-${i}`} className="bg-amber-50/50">
                          <td className="px-4 py-2 text-stone-700">{item.breakpointName}</td>
                          <td className="px-4 py-2 text-stone-700">{item.timeSlot}</td>
                          <td className="px-4 py-2 text-stone-700">{item.sourceDate}</td>
                          <td className="px-4 py-2 text-stone-700">{item.passengerCount}</td>
                          <td className="px-4 py-2">
                            <span className="text-amber-600 text-xs font-medium">重复（跳过）</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={resetForm}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={loading.importExecute}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading.importExecute ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        导入中...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        确认导入
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-stone-800 mb-2">导入成功</h3>
                <p className="text-sm text-stone-500 mb-6">
                  公交刷卡时段数据已导入，系统自动跳过了重复数据
                </p>
                <button
                  onClick={resetForm}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  继续导入
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <div className="px-6 py-4 border-b border-stone-200">
            <h3 className="font-bold text-stone-800">最近导入记录</h3>
          </div>
          <div className="divide-y divide-stone-100 max-h-[480px] overflow-y-auto">
            {importBatches.length === 0 ? (
              <div className="px-6 py-8 text-center text-stone-400 text-sm">暂无导入记录</div>
            ) : (
              importBatches.map((b) => (
                <div key={b.id} className="px-6 py-4">
                  <div className="font-medium text-stone-800 text-sm">{b.fileName}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-stone-500">
                    <span>导入 {b.importedCount} 条</span>
                    <span className="text-amber-600">重复 {b.duplicateCount} 条</span>
                  </div>
                  <div className="text-xs text-stone-400 mt-1">
                    {b.importedBy} · {new Date(b.importedAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportPage;
