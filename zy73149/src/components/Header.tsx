import { Anchor, Download, GitCompare, History, Settings } from 'lucide-react';
import { useReportStore } from '@/store/reportStore';

interface HeaderProps {
  onOpenVersionSidebar?: () => void;
}

export default function Header({ onOpenVersionSidebar }: HeaderProps) {
  const {
    getCurrentVersion,
    versions,
    currentVersionId,
    setCurrentVersion,
    toggleExportModal,
    toggleVersionSidebar,
  } = useReportStore();

  const currentVersion = getCurrentVersion();

  return (
    <header className="bg-ocean-900 text-white shadow-lg">
      <div className="flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-ocean-700 rounded flex items-center justify-center">
            <Anchor size={22} className="text-ocean-200" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide">港湾淤积报告汇总</h1>
            <p className="text-ocean-300 text-xs">Harbor Sediment Report System</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-ocean-300 text-sm">当前版本:</span>
            <select
              value={currentVersionId}
              onChange={(e) => setCurrentVersion(e.target.value)}
              className="bg-ocean-800 text-white text-sm rounded px-3 py-1.5 border border-ocean-600 focus:outline-none focus:border-ocean-400"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {currentVersion && (
            <div className="hidden md:block text-ocean-300 text-sm">
              <span className="text-ocean-500">|</span> 操作人: {currentVersion.operator}
            </div>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={toggleVersionSidebar}
              className="p-2 hover:bg-ocean-800 rounded transition-colors"
              title="版本历史"
            >
              <History size={18} />
            </button>
            <button
              onClick={toggleExportModal}
              className="p-2 hover:bg-ocean-800 rounded transition-colors"
              title="导出报告"
            >
              <Download size={18} />
            </button>
            <a
              href="/compare"
              className="p-2 hover:bg-ocean-800 rounded transition-colors"
              title="版本对比"
            >
              <GitCompare size={18} />
            </a>
            <button
              className="p-2 hover:bg-ocean-800 rounded transition-colors"
              title="设置"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
