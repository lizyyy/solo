import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { useFilteredData } from '@/hooks/useFilteredData';
import QualityDashboard from '@/components/QualityDashboard';
import FilterPanel from '@/components/FilterPanel';
import DataTable from '@/components/DataTable';
import ImportModal from '@/components/ImportModal';
import { Bus, BarChart3, Upload, RotateCcw, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DataOverview() {
  const { filteredSamples } = useFilteredData();
  const { filteredChains } = useFilteredData();
  const caliberLabel = useStore((s) => s.caliberLabel);
  const totalSamples = useStore((s) => s.samples.length);
  const importHistory = useStore((s) => s.importHistory);
  const resetSamples = useStore((s) => s.resetSamples);
  const navigate = useNavigate();
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <FilterPanel />
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#0F4C5C' }}>
              <Bus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#0F4C5C' }}>公交发车间隔优化</h1>
              <p className="text-xs text-gray-500">
                当前口径：{caliberLabel} · 显示 {filteredSamples.length} / 共 {totalSamples} 条样本
                {importHistory.length > 0 && (
                  <span className="ml-2 text-teal-600">（已导入 {importHistory.length} 批）</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#0F4C5C' }}
            >
              <Upload className="w-4 h-4" />
              导入CSV
            </button>
            {importHistory.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('确定要重置所有数据吗？导入的记录将被清除。')) {
                    resetSamples();
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                重置
              </button>
            )}
            <button
              onClick={() => navigate('/optimize')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#E36414' }}
            >
              <BarChart3 className="w-4 h-4" />
              查看优化判断
            </button>
          </div>
        </div>

        {importHistory.length > 0 && (
          <div className="mb-4 bg-teal-50 border border-teal-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <History className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-medium text-teal-800">导入历史</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {importHistory.map((h, i) => (
                <span key={i} className="text-xs bg-white border border-teal-200 rounded-md px-2 py-1 text-teal-700">
                  {h.fileName} · {h.count}条 · {new Date(h.timestamp).toLocaleString('zh-CN')}
                </span>
              ))}
            </div>
          </div>
        )}

        <QualityDashboard />
        <div className="mt-6">
          <DataTable />
        </div>
      </div>

      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
