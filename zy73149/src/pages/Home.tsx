import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, CheckCircle2 } from 'lucide-react';
import Header from '@/components/Header';
import FilterPanel from '@/components/FilterPanel';
import StatCards from '@/components/StatCards';
import DataTable from '@/components/DataTable';
import VersionSidebar from '@/components/VersionSidebar';
import ExportModal from '@/components/ExportModal';
import { useReportStore } from '@/store/reportStore';
import { decodeFilterState } from '@/utils/export';
import { mockVersions } from '@/data/mockData';

export default function Home() {
  const {
    versionSidebarOpen,
    setCurrentVersion,
    setFilter,
    getCurrentVersion,
  } = useReportStore();
  const [searchParams] = useSearchParams();
  const [restoreNotice, setRestoreNotice] = useState<{
    version: string;
    hasFilter: boolean;
  } | null>(null);

  useEffect(() => {
    const versionParam = searchParams.get('version');
    const filterParam = searchParams.get('filter');

    let appliedVersion = false;
    let appliedFilter = false;

    if (versionParam && mockVersions.some((v) => v.id === versionParam)) {
      setCurrentVersion(versionParam);
      appliedVersion = true;
    }

    if (filterParam) {
      const decoded = decodeFilterState(filterParam);
      if (decoded) {
        setFilter(decoded);
        appliedFilter = true;
      }
    }

    if (appliedVersion || appliedFilter) {
      const v = appliedVersion
        ? mockVersions.find((vv) => vv.id === versionParam)?.name || versionParam!
        : getCurrentVersion()?.name || '';
      setRestoreNotice({ version: v, hasFilter: appliedFilter });
    }
  }, [searchParams, setCurrentVersion, setFilter, getCurrentVersion]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className={`transition-all duration-300 ${versionSidebarOpen ? 'mr-80' : ''}`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          {restoreNotice && (
            <div className="mb-4 bg-ocean-50 border border-ocean-200 rounded-lg px-4 py-3 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2 text-ocean-800 text-sm">
                <CheckCircle2 size={18} className="text-ocean-600" />
                <span>
                  已从链接恢复视图：
                  <span className="font-medium">{restoreNotice.version}</span>
                  {restoreNotice.hasFilter && (
                    <span className="text-ocean-600">（含筛选条件）</span>
                  )}
                  ，页面展示与导出时同一批记录。
                </span>
              </div>
              <button
                onClick={() => setRestoreNotice(null)}
                className="p-1 text-ocean-500 hover:text-ocean-800 hover:bg-ocean-100 rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          )}

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
