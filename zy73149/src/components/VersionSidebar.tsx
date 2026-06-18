import { X, Clock, User, FileText, ChevronRight } from 'lucide-react';
import { useReportStore } from '@/store/reportStore';
import { useNavigate } from 'react-router-dom';

export default function VersionSidebar() {
  const {
    versions,
    currentVersionId,
    setCurrentVersion,
    versionSidebarOpen,
    toggleVersionSidebar,
  } = useReportStore();
  const navigate = useNavigate();

  if (!versionSidebarOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-gray-200 shadow-xl z-40 animate-slide-in-right">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Clock size={18} className="text-ocean-600" />
          版本历史
        </h3>
        <button
          onClick={toggleVersionSidebar}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="h-[calc(100%-64px)] overflow-y-auto">
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

          <div className="space-y-0">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className={`relative pl-12 pr-4 py-4 cursor-pointer transition-colors ${
              currentVersionId === version.id
                ? 'bg-ocean-50'
                : 'hover:bg-gray-50'
            }`}
                onClick={() => setCurrentVersion(version.id)}
              >
                <div
                  className={`absolute left-4 top-5 w-4 h-4 rounded-full border-2 ${
                currentVersionId === version.id
                  ? 'border-ocean-600 bg-ocean-600'
                  : 'border-gray-300 bg-white'
              }`}
                ></div>

                <div className="pt-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-medium text-sm ${
                        currentVersionId === version.id
                          ? 'text-ocean-700'
                          : 'text-gray-700'
                      }`}
                    >
                      {version.name}
                    </span>
                    {currentVersionId === version.id && (
                      <span className="text-xs text-ocean-600 bg-ocean-100 px-2 py-0.5 rounded">
                        当前
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={12} />
                    {version.createdAt}
                  </div>

                  <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                    <User size={12} />
                    {version.operator}
                  </div>

                  <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">
                    <FileText size={12} className="inline mr-1" />
                    {version.remark}
                  </div>

                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                    <span>共{version.recordCount}条</span>
                    <span className="text-green-600">正常{version.normalCount}</span>
                    <span className="text-warning-600">异常{version.anomalyCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => navigate('/compare')}
            className="w-full py-2 px-4 bg-ocean-600 text-white text-sm rounded hover:bg-ocean-700 transition-colors flex items-center justify-center gap-2"
          >
            <ChevronRight size={16} />
            版本对比
          </button>
        </div>
      </div>
    </div>
  );
}
