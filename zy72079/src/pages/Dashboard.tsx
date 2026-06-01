import { useStore } from '../store/useStore';
import { StatCard } from '../components/StatCard';
import { FilterPanel } from '../components/FilterPanel';
import { DataTable } from '../components/DataTable';
import { CloudRain } from 'lucide-react';

export default function Dashboard() {
  const statistics = useStore(state => state.getStatistics());

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-600 rounded-lg">
                <CloudRain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 font-display">城市雨水管网容量估算系统</h1>
                <p className="text-sm text-slate-500">可追溯 · 可复查 · 可导出</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">
                今日: {new Date().toLocaleDateString('zh-CN')}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-5 gap-4 mb-8">
          <StatCard title="总记录数" value={statistics.total} type="total" />
          <StatCard title="顺利完成" value={statistics.success} type="success" />
          <StatCard title="待确认" value={statistics.pending} type="pending" />
          <StatCard title="旧口径" value={statistics.legacy} type="legacy" />
          <StatCard title="计算失败" value={statistics.error} type="error" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <FilterPanel />
          </div>
          <div className="lg:col-span-3">
            <DataTable />
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <p className="text-sm text-slate-500 text-center">
            城市雨水管网容量估算系统 · 产品小岑专属 · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
