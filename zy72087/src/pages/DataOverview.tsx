import { useStore } from '@/store/useStore';
import { useFilteredData } from '@/hooks/useFilteredData';
import QualityDashboard from '@/components/QualityDashboard';
import FilterPanel from '@/components/FilterPanel';
import DataTable from '@/components/DataTable';
import { Bus, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DataOverview() {
  const { filteredSamples } = useFilteredData();
  const caliberLabel = useStore((s) => s.caliberLabel);
  const navigate = useNavigate();

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
              <p className="text-xs text-gray-500">当前口径：{caliberLabel} · 共 {filteredSamples.length} 条样本</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/optimize')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#E36414' }}
          >
            <BarChart3 className="w-4 h-4" />
            查看优化判断
          </button>
        </div>

        <QualityDashboard />
        <div className="mt-6">
          <DataTable />
        </div>
      </div>
    </div>
  );
}
