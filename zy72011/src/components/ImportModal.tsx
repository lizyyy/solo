import React, { useState } from 'react';
import { WarningRecord, ImportResult } from '../types';
import { useWarningStore } from '../hooks/useWarningStore';
import { processImport } from '../utils/duplicateChecker';
import DiffViewer from './DiffViewer';

interface ImportModalProps {
  onClose: () => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ onClose }) => {
  const { records, addRecords, updateRecords } = useWarningStore();
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<(ImportResult & { recordsToAdd: WarningRecord[]; recordsToUpdate: WarningRecord[] }) | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'input' | 'review'>('input');

  const handleAnalyze = () => {
    try {
      setError('');
      const data = JSON.parse(importText);
      const newRecords = Array.isArray(data) ? data : [data];
      const result = processImport(newRecords, records);
      setImportResult(result);
      setStep('review');
    } catch (e) {
      setError('JSON格式解析失败，请检查输入内容');
    }
  };

  const handleConfirm = () => {
    if (!importResult) return;
    
    if (importResult.recordsToAdd.length > 0) {
      addRecords(importResult.recordsToAdd);
    }
    if (importResult.recordsToUpdate.length > 0) {
      updateRecords(importResult.recordsToUpdate);
    }
    onClose();
  };

  const sampleImportData = JSON.stringify([
    {
      id: '4',
      supplierName: '上海创新科技有限公司',
      billAmount: 156000,
      warningType: 'other',
      status: 'pending',
      source: 'supplement',
      originalRemark: '新增测试记录',
      currentRemark: '新增测试记录',
      materials: [],
      history: [{ id: 'h1', action: 'create', operator: '测试', time: '2024-01-01 00:00:00' }],
      createdAt: '2024-01-01 00:00:00',
      updatedAt: '2024-01-01 00:00:00',
      processingAdvice: '请复核',
    },
  ], null, 2);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">导入数据</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl">
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {step === 'input' ? (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  粘贴JSON数据
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="粘贴JSON格式的预警记录..."
                  className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                />
              </div>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">样例数据（可复制测试）：</p>
                <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                  {sampleImportData}
                </pre>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={!importText.trim()}
                  className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  分析数据
                </button>
              </div>
            </>
          ) : (
            <>
              {importResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{importResult.total}</div>
                      <div className="text-sm text-blue-700">总计</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-gray-600">{importResult.skipped}</div>
                      <div className="text-sm text-gray-700">跳过</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{importResult.updated + importResult.recordsToAdd.length}</div>
                      <div className="text-sm text-green-700">更新/新增</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">{importResult.conflicts}</div>
                      <div className="text-sm text-orange-700">冲突</div>
                    </div>
                  </div>

                  {importResult.conflictItems.length > 0 && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                      <p className="font-medium text-orange-800 mb-2">冲突记录：</p>
                      <ul className="text-sm text-orange-700 list-disc list-inside">
                        {importResult.conflictItems.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {importResult.diffReport.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-800">差异详情：</h4>
                      {importResult.diffReport.map((report, idx) => (
                        <DiffViewer key={idx} diffs={report.diffs} title={`记录 #${report.recordId}`} />
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      onClick={() => setStep('input')}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                    >
                      返回修改
                    </button>
                    <button
                      onClick={handleConfirm}
                      className="px-4 py-2 bg-success text-white rounded-md hover:bg-green-700"
                    >
                      确认导入
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
