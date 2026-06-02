import { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, Trash2, Play, Sparkles, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store';
import { createPoint } from '../data/sampleData';
import { Point } from '../types';
import { cn } from '../lib/utils';

export function ImportPage() {
  const { addPoints, loadSampleData, loadSmoothCase, loadReworkCase, clearAllData, importStats, points } = useAppStore();
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    setImporting(true);
    setImportResult(null);

    for (const file of files) {
      try {
        const text = await file.text();
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(text);
          const newPoints = Array.isArray(data) ? data : [data];
          addPoints(newPoints.map((p: Partial<Point>) => createPoint(p)));
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split('\n').slice(1);
          const newPoints = lines
            .filter((line) => line.trim())
            .map((line) => {
              const [name, address, lat, lng, source, category, description] = line.split(',');
              return createPoint({
                name: name?.replace(/"/g, ''),
                address: address?.replace(/"/g, ''),
                lat: parseFloat(lat),
                lng: parseFloat(lng),
                source: (source?.replace(/"/g, '') as any) || 'gis',
                category: category?.replace(/"/g, ''),
                description: description?.replace(/"/g, ''),
              });
            });
          addPoints(newPoints);
        }
      } catch (error) {
        console.error('Error importing file:', error);
      }
    }

    setImporting(false);
    setImportResult(`成功导入 ${files.length} 个文件`);
    setTimeout(() => setImportResult(null), 3000);
  };

  const handleSampleData = () => {
    setImporting(true);
    setTimeout(() => {
      loadSampleData();
      setImporting(false);
      setImportResult('示例数据加载完成');
      setTimeout(() => setImportResult(null), 3000);
    }, 500);
  };

  const handleSmoothCase = () => {
    setImporting(true);
    setTimeout(() => {
      loadSmoothCase();
      setImporting(false);
      setImportResult('顺利处理场景数据加载完成');
      setTimeout(() => setImportResult(null), 3000);
    }, 500);
  };

  const handleReworkCase = () => {
    setImporting(true);
    setTimeout(() => {
      loadReworkCase();
      setImporting(false);
      setImportResult('需要返工场景数据加载完成');
      setTimeout(() => setImportResult(null), 3000);
    }, 500);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">数据导入</h1>
        <p className="text-gray-600">导入GIS点位、居民反馈、巡检记录和街道备注数据</p>
      </div>

      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-12 text-center transition-all mb-8',
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept=".json,.csv"
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-lg font-medium text-gray-700 mb-2">
              拖拽文件到此处，或点击上传
            </p>
            <p className="text-sm text-gray-500">支持 JSON、CSV 格式</p>
          </div>
        </label>
      </div>

      {importResult && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-700">{importResult}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6 mb-8">
        <button
          onClick={handleSmoothCase}
          disabled={importing}
          className="p-6 bg-white rounded-xl border border-gray-200 hover:border-green-400 hover:shadow-lg transition-all group text-left"
        >
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">顺利处理场景</h3>
          <p className="text-sm text-gray-500 mb-4">同一点位不同写法，可直接归并</p>
          <span className="text-sm text-green-600 font-medium flex items-center gap-1">
            <Play className="w-4 h-4" />
            一键加载
          </span>
        </button>

        <button
          onClick={handleReworkCase}
          disabled={importing}
          className="p-6 bg-white rounded-xl border border-gray-200 hover:border-orange-400 hover:shadow-lg transition-all group text-left"
        >
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-orange-200 transition-colors">
            <RefreshCw className="w-6 h-6 text-orange-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">需要返工场景</h3>
          <p className="text-sm text-gray-500 mb-4">疑似相同但实际不同，需要人工判断</p>
          <span className="text-sm text-orange-600 font-medium flex items-center gap-1">
            <Play className="w-4 h-4" />
            一键加载
          </span>
        </button>

        <button
          onClick={handleSampleData}
          disabled={importing}
          className="p-6 bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all group text-left"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
            <Sparkles className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">完整示例数据</h3>
          <p className="text-sm text-gray-500 mb-4">包含所有类型的多源数据</p>
          <span className="text-sm text-blue-600 font-medium flex items-center gap-1">
            <Play className="w-4 h-4" />
            一键加载
          </span>
        </button>
      </div>

      {points.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-gray-500" />
              已导入数据 ({points.length})
            </h3>
            <button
              onClick={clearAllData}
              className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              清空所有
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">点位名称</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">地址</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">来源</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">类别</th>
                </tr>
              </thead>
              <tbody>
                {points.slice(0, 10).map((point) => (
                  <tr key={point.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">{point.name}</td>
                    <td className="py-3 px-4 text-gray-600">{point.address}</td>
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          'px-2 py-1 text-xs rounded-full',
                          point.source === 'gis' && 'bg-blue-100 text-blue-700',
                          point.source === 'resident' && 'bg-purple-100 text-purple-700',
                          point.source === 'inspection' && 'bg-teal-100 text-teal-700',
                          point.source === 'street' && 'bg-amber-100 text-amber-700'
                        )}
                      >
                        {point.source === 'gis' && 'GIS'}
                        {point.source === 'resident' && '居民反馈'}
                        {point.source === 'inspection' && '巡检'}
                        {point.source === 'street' && '街道备注'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{point.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {points.length > 10 && (
              <p className="text-center text-sm text-gray-500 py-4">
                还有 {points.length - 10} 条数据未显示
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
