import React, { useState } from 'react';
import { api } from '../api';
import type { ImportResult } from '../types';

interface ImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImported }) => {
  const [operator, setOperator] = useState('当前用户');
  const [csvContent, setCsvContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!csvContent.trim()) {
      alert('请选择CSV文件或粘贴内容');
      return;
    }

    setLoading(true);
    try {
      const importResult = await api.importCSV(csvContent, operator);
      setResult(importResult);
      
      if (importResult.success > 0 || importResult.duplicates > 0) {
        onImported();
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">批量导入</h2>
          <button
            className="text-gray-400 hover:text-gray-600 text-2xl"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              操作人
            </label>
            <input
              type="text"
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择CSV文件
            </label>
            <input
              type="file"
              accept=".csv"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              onChange={handleFileChange}
            />
            <p className="mt-1 text-xs text-gray-500">
              支持的列名：保证函编号/guaranteeNo, 客户名称/customerName, 金额/amount, 币种/currency, 来源/source, 来源参考/sourceRef, 备注/remark
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              或粘贴CSV内容
            </label>
            <textarea
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2 border font-mono"
              rows={8}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder={`保证函编号,客户名称,金额,币种,来源,备注
GH2024001,示例公司A,1000000,CNY,审批截图,
GH2024002,示例公司B,500000,CNY,复核日报,`}
            />
          </div>

          {result && (
            <div className={`rounded-lg p-4 ${result.errors > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
              <h4 className="font-medium text-gray-900 mb-2">导入结果</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">成功导入：</span>
                  <span className="font-medium text-green-600">{result.success} 条</span>
                </div>
                <div>
                  <span className="text-gray-500">疑似重复：</span>
                  <span className="font-medium text-yellow-600">{result.duplicates} 条</span>
                </div>
                <div>
                  <span className="text-gray-500">导入失败：</span>
                  <span className="font-medium text-red-600">{result.errors} 条</span>
                </div>
              </div>
              {result.errorDetails.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-red-700 mb-1">错误详情：</p>
                  <ul className="text-sm text-red-600 list-disc list-inside space-y-1">
                    {result.errorDetails.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              onClick={onClose}
            >
              关闭
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              onClick={handleImport}
              disabled={loading || !csvContent.trim()}
            >
              {loading ? '导入中...' : '开始导入'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
