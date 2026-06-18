import Header from '@/components/Header';
import FilterPanel from '@/components/FilterPanel';
import StatCards from '@/components/StatCards';
import DataTable from '@/components/DataTable';
import VersionSidebar from '@/components/VersionSidebar';
import ExportModal from '@/components/ExportModal';
import { useReportStore } from '@/store/reportStore';

export default function Home() {
  const { versionSidebarOpen } = useReportStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className={`transition-all duration-300 ${versionSidebarOpen ? 'mr-80' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800">淤积数据汇总</h2>
            <p className="text-sm text-gray-500 mt-1">
              汇总浮标与遥感监测数据，统一经纬度格式，识别异常记录
            </p>
          </div>

          <FilterPanel />
          <StatCards />
          <DataTable />
        </div>
      </main>

      <VersionSidebar />
      <ExportModal />
    </div>
  );
}
