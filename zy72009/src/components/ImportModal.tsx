import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import Modal from './Modal';
import { useSettlementStore } from '../store/useSettlementStore';
import type { ImportStrategy, ImportResult } from '../types';
import { IMPORT_STRATEGY_LABELS } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [strategy, setStrategy] = useState<ImportStrategy>('skip');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importData = useSettlementStore(state => state.importData);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setError(null);
    try {
      const importResult = await importData(file, strategy);
      setResult(importResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setStrategy('skip');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="导入清分数据"
      size="lg"
    >
      <div className="space-y-6">
        {!result && (
          <>
            <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors">
              <input
                type="file"
                id="file-upload"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <Upload className="w-12 h-12 text-neutral-400" />
                <div>
                  <p className="text-sm font-medium text-neutral-700">
                    {file ? file.name : '点击选择文件'}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    支持 .xlsx, .xls, .csv 格式
                  </p>
                </div>
              </label>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-700">
                重复数据处理策略
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['skip', 'update', 'conflict'] as ImportStrategy[]).map(s => (
                  <label
                    key={s}
                    className={`flex flex-col items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      strategy === s
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="strategy"
                      value={s}
                      checked={strategy === s}
                      onChange={() => setStrategy(s)}
                      className="sr-only"
                    />
                    <ArrowRight
                      className={`w-5 h-5 mb-2 ${
                        strategy === s ? 'text-primary-600' : 'text-neutral-400'
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        strategy === s ? 'text-primary-700' : 'text-neutral-700'
                      }`}
                    >
                      {IMPORT_STRATEGY_LABELS[s]}
                    </span>
                    <span className="text-xs text-neutral-500 mt-1 text-center">
                      {s === 'skip' && '保留原有数据'}
                      {s === 'update' && '用新数据覆盖'}
                      {s === 'conflict' && '标记人工处理'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg flex items-start gap-3">
                <XCircle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-danger-700">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
              <button className="btn" onClick={handleClose}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={!file || importing}
              >
                {importing ? '导入中...' : '开始导入'}
              </button>
            </div>
          </>
        )}

        {result && (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-success-600" />
              </div>
            </div>

            <div className="text-center">
              <h4 className="text-lg font-semibold text-neutral-900">导入完成</h4>
              <p className="text-sm text-neutral-500 mt-1">共处理 {result.total} 条数据</p>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-success-50 rounded-lg">
                <p className="text-2xl font-bold text-success-600">{result.success}</p>
                <p className="text-xs text-success-700">成功导入</p>
              </div>
              <div className="text-center p-4 bg-neutral-50 rounded-lg">
                <p className="text-2xl font-bold text-neutral-600">{result.skipped}</p>
                <p className="text-xs text-neutral-700">跳过</p>
              </div>
              <div className="text-center p-4 bg-primary-50 rounded-lg">
                <p className="text-2xl font-bold text-primary-600">{result.updated}</p>
                <p className="text-xs text-primary-700">更新</p>
              </div>
              <div className="text-center p-4 bg-warning-50 rounded-lg">
                <p className="text-2xl font-bold text-warning-600">{result.conflict}</p>
                <p className="text-xs text-warning-700">冲突</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-amber-800">
                    处理说明（{result.errors.length} 条）
                  </span>
                </div>
                <ul className="text-sm text-amber-700 space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.slice(0, 10).map((err, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-500">•</span>
                      {err}
                    </li>
                  ))}
                  {result.errors.length > 10 && (
                    <li className="text-amber-600 italic">
                      ...还有 {result.errors.length - 10} 条提示
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-neutral-200">
              <button className="btn btn-primary" onClick={handleClose}>
                完成
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
