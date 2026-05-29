import { useState, useRef } from 'react';
import { X, Upload, AlertCircle, CheckCircle, SkipForward, RefreshCw, Plus } from 'lucide-react';
import { useFlagStore } from '../store/flagStore';
import type { ImportConflictStrategy } from '../types';

export function ImportModal() {
  const {
    showImportModal,
    setShowImportModal,
    processImport,
    importResult,
    importPendingConflicts,
    resolveImportConflict,
    resolveAllConflicts,
    loading,
  } = useFlagStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    await processImport(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleConflict = (flagKey: string, strategy: ImportConflictStrategy) => {
    resolveImportConflict(flagKey, strategy);
  };

  const strategyLabels: Record<ImportConflictStrategy, { icon: React.ReactNode; label: string; desc: string }> = {
    skip: {
      icon: <SkipForward className="w-4 h-4" />,
      label: '跳过',
      desc: '保留现有数据，不导入该条',
    },
    overwrite: {
      icon: <RefreshCw className="w-4 h-4" />,
      label: '覆盖',
      desc: '用新数据覆盖现有数据',
    },
    append: {
      icon: <Plus className="w-4 h-4" />,
      label: '追加',
      desc: '作为新记录追加，保留历史',
    },
  };

  if (!showImportModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">导入功能开关</h3>
          <button
            onClick={() => setShowImportModal(false)}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4" />
              <p className="text-gray-600">正在解析文件...</p>
            </div>
          )}

          {!loading && !selectedFile && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
              }`}
            >
              <Upload className={`w-12 h-12 mx-auto mb-4 ${dragOver ? 'text-primary-600' : 'text-gray-300'}`} />
              <p className="text-gray-700 font-medium mb-2">点击或拖拽文件到此处</p>
              <p className="text-sm text-gray-400">支持 .xlsx, .csv, .json 格式</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv,.json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </div>
          )}

          {!loading && importPendingConflicts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-risk-medium" />
                  <span className="font-medium text-gray-900">发现 {importPendingConflicts.length} 条重复数据</span>
                </div>
                <div className="flex gap-2">
                  {(['skip', 'overwrite', 'append'] as ImportConflictStrategy[]).map(strategy => (
                    <button
                      key={strategy}
                      onClick={() => resolveAllConflicts(strategy)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {strategyLabels[strategy].icon}
                      全部{strategyLabels[strategy].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {importPendingConflicts.map(conflict => (
                  <div key={conflict.flagKey} className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="font-medium text-gray-900">{conflict.existing.name}</p>
                        <p className="text-sm text-gray-500 font-mono">{conflict.flagKey}</p>
                      </div>
                      <div className="flex gap-2">
                        {(['skip', 'overwrite', 'append'] as ImportConflictStrategy[]).map(strategy => (
                          <button
                            key={strategy}
                            onClick={() => handleConflict(conflict.flagKey, strategy)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              strategy === 'skip' ? 'hover:bg-gray-100 text-gray-600' :
                              strategy === 'overwrite' ? 'hover:bg-primary-50 text-primary-700' :
                              'hover:bg-risk-low/10 text-risk-low'
                            }`}
                            title={strategyLabels[strategy].desc}
                          >
                            {strategyLabels[strategy].icon}
                            {strategyLabels[strategy].label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 bg-white rounded-lg">
                        <p className="text-xs text-gray-400 mb-1">现有数据</p>
                        <p className="text-gray-600">负责人: {conflict.existing.owner || '-'}</p>
                        <p className="text-gray-600">状态: {conflict.existing.status}</p>
                      </div>
                      <div className="p-3 bg-primary-50 rounded-lg">
                        <p className="text-xs text-primary-400 mb-1">导入数据</p>
                        <p className="text-primary-700">负责人: {conflict.incoming.owner || '-'}</p>
                        <p className="text-primary-700">描述: {conflict.incoming.description || '-'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && importResult && (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-risk-low mx-auto mb-4" />
              <h4 className="text-xl font-semibold text-gray-900 mb-2">导入完成</h4>
              <div className="grid grid-cols-4 gap-4 max-w-md mx-auto mt-6">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{importResult.total}</p>
                  <p className="text-xs text-gray-500">总计</p>
                </div>
                <div className="p-3 bg-risk-low/10 rounded-lg">
                  <p className="text-2xl font-bold text-risk-low">{importResult.success}</p>
                  <p className="text-xs text-gray-500">成功</p>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <p className="text-2xl font-bold text-gray-600">{importResult.skipped}</p>
                  <p className="text-xs text-gray-500">跳过</p>
                </div>
                <div className="p-3 bg-primary-50 rounded-lg">
                  <p className="text-2xl font-bold text-primary-700">{importResult.overwritten}</p>
                  <p className="text-xs text-gray-500">覆盖</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          {importResult ? (
            <button onClick={() => setShowImportModal(false)} className="btn-primary">
              完成
            </button>
          ) : (
            <button onClick={() => setShowImportModal(false)} className="btn-secondary">
              取消
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
