import React, { useState, useCallback } from 'react';
import { Upload, FileText, Database, Trash2, ChevronRight, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { MealPoint } from '../types';
import { generateId } from '../utils/storage';
import Papa from 'papaparse';

export function DataImportPage() {
  const { points, loadSampleData, clearAllData, addPoints, setCurrentStep } = useApp();
  const [isDragging, setIsDragging] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importMessage, setImportMessage] = useState<string>('');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const processFile = (file: File) => {
    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const parsed = results.data
            .filter((row: any) => row.name || row.address)
            .map((row: any, index: number) => ({
              id: `import-${Date.now()}-${index}`,
              name: row.name || row.名称 || '',
              address: row.address || row.地址 || '',
              lat: parseFloat(row.lat || row.纬度 || '31.23'),
              lng: parseFloat(row.lng || row.经度 || '121.47'),
              source: (row.source || row.来源 || 'GIS') as MealPoint['source'],
              status: 'pending' as MealPoint['status'],
              type: 'smooth' as MealPoint['type'],
              mergeHistory: [],
              notes: row.notes || row.备注 || '',
              auditTrail: [{
                id: generateId(),
                action: 'import' as const,
                operator: '老曹',
                remark: `从文件 ${file.name} 导入`,
                timestamp: new Date(),
              }],
              createdAt: new Date(),
              updatedAt: new Date(),
            }));
          setPreviewData(parsed);
          setImportMessage(`成功解析 ${parsed.length} 条数据，点击"确认导入"添加到系统`);
        },
      });
    } else {
      setImportMessage('仅支持CSV格式文件');
    }
  };

  const handleConfirmImport = () => {
    addPoints(previewData);
    setPreviewData([]);
    setImportMessage(`成功导入 ${previewData.length} 条点位数据`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary-700">数据导入</h1>
          <p className="mt-1 text-sm text-gray-500">导入GIS点位、居民反馈、巡检记录和街道备注</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadSampleData}
            className="inline-flex items-center px-4 py-2 bg-warm-500 text-white rounded-lg hover:bg-warm-600 transition-colors shadow-md hover:shadow-lg"
          >
            <Database className="w-4 h-4 mr-2" />
            加载样例数据
          </button>
          {points.length > 0 && (
            <button
              onClick={clearAllData}
              className="inline-flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              清空数据
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isDragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50/50'
          }`}
        >
          <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">拖拽CSV文件到此处</p>
          <p className="text-sm text-gray-500 mb-4">或点击下方按钮选择文件</p>
          <label className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg cursor-pointer hover:bg-primary-700 transition-colors">
            <FileText className="w-4 h-4 mr-2" />
            选择文件
            <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
          </label>
          <p className="mt-4 text-xs text-gray-400">支持字段：name/名称, address/地址, lat/纬度, lng/经度, source/来源, notes/备注</p>
        </div>

        <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl p-6 text-white">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Info className="w-5 h-5 mr-2" />
            样例数据说明
          </h3>
          <div className="space-y-3 text-sm text-primary-100">
            <p>• <strong className="text-white">顺利记录</strong>：可自动归并的同一地点不同写法</p>
            <p>• <strong className="text-white">待确认记录</strong>：需要人工判断的相似点位</p>
            <p>• <strong className="text-white">旧口径记录</strong>：从GIS点位补来的历史数据</p>
            <p>• <strong className="text-white">空值记录</strong>：名称字段为空的边界情况</p>
            <p>• <strong className="text-white">边界记录</strong>：相邻点位需确认是否合并</p>
            <p>• <strong className="text-white">重复项</strong>：同一来源的重复点位</p>
          </div>
          <p className="mt-4 text-xs text-primary-200">点击"加载样例数据"按钮即可体验完整流程</p>
        </div>
      </div>

      {importMessage && (
        <div className={`p-4 rounded-lg ${previewData.length > 0 ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
          {importMessage}
          {previewData.length > 0 && (
            <button
              onClick={handleConfirmImport}
              className="ml-4 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              确认导入
            </button>
          )}
        </div>
      )}

      {previewData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="font-semibold text-gray-700">数据预览</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">地址</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">来源</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {previewData.slice(0, 5).map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{row.name || '(空)'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.address}</td>
                    <td className="px-4 py-3">
                      <StatusBadge type="source" value={row.source} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewData.length > 5 && (
            <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500 text-center">
              还有 {previewData.length - 5} 条数据未显示
            </div>
          )}
        </div>
      )}

      {points.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">已导入数据 ({points.length} 条)</h3>
            <button
              onClick={() => setCurrentStep('merge')}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              前往点位归并
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">点位名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">地址</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">来源</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {points.map((point) => (
                  <tr key={point.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      {point.name || '(未命名)'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{point.address}</td>
                    <td className="px-4 py-3">
                      <StatusBadge type="source" value={point.source} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge type="pointType" value={point.type} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge type="status" value={point.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
