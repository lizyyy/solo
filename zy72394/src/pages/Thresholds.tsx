import { useState } from 'react';
import {
  Upload,
  Plus,
  Trash2,
  Edit,
  Eye,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
} from 'lucide-react';
import { useThresholdStore } from '@/store/useThresholdStore';
import { formatDate } from '@/utils/helpers';
import type { SafetyThreshold } from '@/types';
import { mockThresholds } from '@/utils/mockData';

export function Thresholds() {
  const thresholds = useThresholdStore(state => state.thresholds);
  const importThresholds = useThresholdStore(state => state.importThresholds);
  const importResult = useThresholdStore(state => state.importResult);
  const clearImportResult = useThresholdStore(state => state.clearImportResult);
  const deleteThreshold = useThresholdStore(state => state.deleteThreshold);
  const resetToMock = useThresholdStore(state => state.resetToMock);

  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedThreshold, setSelectedThreshold] = useState<SafetyThreshold | null>(null);
  const [importPreview, setImportPreview] = useState<SafetyThreshold[]>([]);

  const handleSimulateImport = () => {
    const sampleData = [...mockThresholds.slice(0, 3), {
      ...mockThresholds[0],
      thresholdCode: 'C60-2024-001',
      minTemp: 12,
      maxTemp: 42,
      warningTemp: 37,
      description: 'C60超高性能混凝土养护温度阈值',
      version: 'v1.0',
    }];
    setImportPreview(sampleData);
  };

  const handleConfirmImport = () => {
    const result = importThresholds(importPreview);
    setImportPreview([]);
    setShowImportModal(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">安全阈值表管理</h1>
          <p className="text-gray-500 mt-1">管理混凝土养护温度安全阈值，支持导入去重和版本追踪</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetToMock}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重置数据
          </button>
          <button
            onClick={() => {
              setShowImportModal(true);
              clearImportResult();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <Upload className="w-4 h-4" />
            导入阈值表
          </button>
        </div>
      </div>

      {importResult && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-industry-success" />
                <span className="text-sm text-gray-700">
                  新增 <strong className="text-industry-success">{importResult.newItems.length}</strong> 条
                </span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary-500" />
                <span className="text-sm text-gray-700">
                  更新 <strong className="text-primary-500">{importResult.updatedItems.length}</strong> 条
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-700">
                  跳过重复 <strong className="text-gray-500">{importResult.duplicateCount}</strong> 条
                </span>
              </div>
            </div>
            <button
              onClick={clearImportResult}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                阈值编号
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                描述
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                最低温度
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                预警温度
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                最高温度
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                版本
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                创建时间
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {thresholds.map((threshold) => (
              <tr key={threshold.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-mono font-medium text-gray-900">
                    {threshold.thresholdCode}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-700">{threshold.description}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm font-mono text-industry-success">
                    {threshold.minTemp}°C
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm font-mono text-industry-warning">
                    {threshold.warningTemp}°C
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm font-mono text-industry-danger">
                    {threshold.maxTemp}°C
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700">
                    {threshold.version}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-500">
                    {formatDate(threshold.createdAt)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setSelectedThreshold(threshold)}
                      className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 text-gray-400 hover:text-industry-warning hover:bg-amber-50 rounded-lg transition-colors"
                      title="编辑"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteThreshold(threshold.id)}
                      className="p-2 text-gray-400 hover:text-industry-danger hover:bg-red-50 rounded-lg transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-800">导入安全阈值表</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportPreview([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {importPreview.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 mb-4">点击下方按钮模拟导入Excel文件</p>
                  <button
                    onClick={handleSimulateImport}
                    className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    选择文件并预览
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    预览 {importPreview.length} 条数据，确认后导入
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">编号</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">描述</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">范围</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importPreview.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 font-mono text-xs">{item.thresholdCode}</td>
                            <td className="px-4 py-2 text-xs text-gray-600">{item.description}</td>
                            <td className="px-4 py-2 text-center text-xs">
                              {item.minTemp}°C ~ {item.maxTemp}°C
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportPreview([]);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              {importPreview.length > 0 && (
                <button
                  onClick={handleConfirmImport}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  确认导入
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedThreshold && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-800">阈值详情</h2>
              <button
                onClick={() => setSelectedThreshold(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <DetailItem label="阈值编号" value={selectedThreshold.thresholdCode} />
              <DetailItem label="描述" value={selectedThreshold.description} />
              <div className="grid grid-cols-3 gap-4">
                <DetailItem label="最低温度" value={`${selectedThreshold.minTemp}°C`} />
                <DetailItem label="预警温度" value={`${selectedThreshold.warningTemp}°C`} />
                <DetailItem label="最高温度" value={`${selectedThreshold.maxTemp}°C`} />
              </div>
              <DetailItem label="版本" value={selectedThreshold.version} />
              <DetailItem label="创建时间" value={formatDate(selectedThreshold.createdAt)} />
            </div>
            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => setSelectedThreshold(null)}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}
