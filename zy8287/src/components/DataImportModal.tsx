import React, { useState, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';

interface DataImportModalProps {
  onClose: () => void;
}

const DataImportModal: React.FC<DataImportModalProps> = ({ onClose }) => {
  const { loadEventsFromFile, loadOrdersFromFile, loadBoothsFromFile, loadTargetsFromFile } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedFiles, setImportedFiles] = useState<Record<string, string>>({});

  const handleFileUpload = useCallback(
    async (fileType: 'events' | 'orders' | 'booths' | 'targets', file: File) => {
      setLoading(true);
      setError(null);
      try {
        switch (fileType) {
          case 'events':
            await loadEventsFromFile(file);
            break;
          case 'orders':
            await loadOrdersFromFile(file);
            break;
          case 'booths':
            await loadBoothsFromFile(file);
            break;
          case 'targets':
            await loadTargetsFromFile(file);
            break;
        }
        setImportedFiles((prev) => ({ ...prev, [fileType]: file.name }));
      } catch (err) {
        setError(err instanceof Error ? err.message : '导入失败');
      } finally {
        setLoading(false);
      }
    },
    [loadEventsFromFile, loadOrdersFromFile, loadBoothsFromFile, loadTargetsFromFile]
  );

  const fileTypes = [
    { key: 'events' as const, label: '客流数据', accept: '.csv', description: 'events.csv' },
    { key: 'orders' as const, label: '成交数据', accept: '.csv', description: 'orders.csv' },
    { key: 'booths' as const, label: '展商数据', accept: '.json', description: 'booths.json' },
    { key: 'targets' as const, label: '时段目标', accept: '.csv', description: 'targets.csv' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">导入数据</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-danger/5 border border-danger/20 rounded-lg text-danger text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {fileTypes.map((fileType) => (
              <div
                key={fileType.key}
                className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                  importedFiles[fileType.key]
                    ? 'border-success/30 bg-success/5'
                    : 'border-gray-200 hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-800">{fileType.label}</h3>
                    <p className="text-xs text-gray-500">{fileType.description}</p>
                  </div>
                  {importedFiles[fileType.key] && (
                    <span className="tag tag-success">已导入</span>
                  )}
                </div>

                <label className="block cursor-pointer">
                  <div className="flex items-center justify-center py-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors">
                    <input
                      type="file"
                      accept={fileType.accept}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(fileType.key, file);
                        }
                      }}
                      className="hidden"
                      disabled={loading}
                    />
                    <div className="text-center">
                      <svg
                        className="w-8 h-8 text-gray-400 mx-auto mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <p className="text-sm text-gray-600">
                        {importedFiles[fileType.key]
                          ? importedFiles[fileType.key]
                          : `点击或拖拽上传 ${fileType.accept.toUpperCase()} 文件`}
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">数据格式说明</h4>
            <div className="space-y-2 text-xs text-gray-500">
              <p>
                <strong>events.csv:</strong> id, timestamp, timeSlot, hallId, boothId, visitorId, entryType, duration
              </p>
              <p>
                <strong>orders.csv:</strong> orderId, timestamp, timeSlot, hallId, boothId, visitorId, amount, productCategory, paymentMethod, status
              </p>
              <p>
                <strong>booths.json:</strong> JSON数组，包含 boothId, hallId, hallName, boothName, exhibitor, industry 等字段
              </p>
              <p>
                <strong>targets.csv:</strong> timeSlot, hallId, targetVisitors, targetOrders, targetRevenue
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-secondary">
            关闭
          </button>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
              <p className="mt-3 text-gray-600">正在导入数据...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataImportModal;
