import { AlertTriangle, ChevronRight, X, Clock, Copy, Ban } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { EXCEPTION_TYPES } from '../../types';
import TagBadge from '../common/TagBadge';

const ExceptionPanel = () => {
  const { materials, preferences, toggleExceptionPanel, openEditModal, setFilter } = useStore();

  const exceptionsByType = EXCEPTION_TYPES.map((excType) => ({
    ...excType,
    items: materials.filter((m) =>
      m.exceptions.some((e) => e.type === excType.type && !e.resolved)
    ),
  }));

  const totalExceptions = exceptionsByType.reduce((sum, exc) => sum + exc.items.length, 0);

  const iconMap = {
    red: <Ban className="w-4 h-4" />,
    amber: <Clock className="w-4 h-4" />,
    purple: <Copy className="w-4 h-4" />,
  };

  if (!preferences.exceptionPanelOpen) {
    return (
      <button
        onClick={toggleExceptionPanel}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-slate-800 text-white px-2 py-4 rounded-l-lg shadow-lg hover:bg-slate-700 transition-colors z-40"
      >
        <div className="flex flex-col items-center gap-1">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <span className="text-xs writing-vertical">{totalExceptions}</span>
        </div>
      </button>
    );
  }

  return (
    <div className="w-80 bg-slate-50 border-l border-slate-200 flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-slate-700">例外清单</h3>
          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
            {totalExceptions} 项
          </span>
        </div>
        <button
          onClick={toggleExceptionPanel}
          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {exceptionsByType.map((excType) => (
          <div key={excType.type} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-${excType.color}-500`}>{iconMap[excType.color as keyof typeof iconMap]}</span>
                <span className="text-sm font-medium text-slate-700">{excType.label}</span>
              </div>
              <span className="text-xs text-slate-500">{excType.items.length} 条</span>
            </div>

            {excType.items.length === 0 ? (
              <p className="text-xs text-slate-400 pl-6">暂无此类异常</p>
            ) : (
              <div className="space-y-1 pl-6">
                {excType.items.slice(0, 5).map((material) => (
                  <button
                    key={material.id}
                    onClick={() => openEditModal(material)}
                    className="w-full flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-orange-300 hover:shadow-sm transition-all text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{material.trackName}</p>
                      <p className="text-xs text-slate-400 truncate">{material.fileName}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-500 transition-colors" />
                  </button>
                ))}
                {excType.items.length > 5 && (
                  <button
                    onClick={() => setFilter({ exceptionType: excType.type })}
                    className="w-full text-center text-xs text-orange-600 hover:text-orange-700 py-1"
                  >
                    还有 {excType.items.length - 5} 条，点击筛选查看全部
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-slate-200 bg-slate-100">
        <p className="text-xs text-slate-500">
          💡 提示：点击条目可快速跳转编辑，处理完记得标为已解决哦
        </p>
      </div>
    </div>
  );
};

export default ExceptionPanel;
