import { X, AlertTriangle, Filter, Info, ChevronRight, Database, CheckCircle } from 'lucide-react';
import { useYardStore } from '@/store/useYardStore';
import { ConflictList } from './ConflictList';
import { FilterPanel } from './FilterPanel';
import { ObjectDetails } from './ObjectDetails';

export function SidePanel() {
  const {
    sidePanelOpen,
    sidePanelTab,
    toggleSidePanel,
    setSidePanelTab,
    selectedObjectId,
    selectedObjectType,
    getFilteredConflicts,
  } = useYardStore();

  const conflictCount = getFilteredConflicts().length;

  if (!sidePanelOpen) {
    return (
      <button
        onClick={toggleSidePanel}
        className="absolute right-0 top-1/2 -translate-y-1/2 bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-l-lg z-20 transition-colors"
      >
        <ChevronRight className="w-5 h-5 rotate-180" />
      </button>
    );
  }

  return (
    <div className="absolute right-0 top-14 bottom-20 w-80 bg-slate-900/95 border-l border-slate-700 flex flex-col z-20">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex gap-1">
          <button
            onClick={() => setSidePanelTab('conflicts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              sidePanelTab === 'conflicts'
                ? 'bg-orange-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            冲突
            {conflictCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">
                {conflictCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setSidePanelTab('filters')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              sidePanelTab === 'filters'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            筛选
          </button>
          <button
            onClick={() => setSidePanelTab('details')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              sidePanelTab === 'details'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Info className="w-4 h-4" />
            详情
          </button>
        </div>
        <button
          onClick={toggleSidePanel}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sidePanelTab === 'conflicts' && <ConflictList />}
        {sidePanelTab === 'filters' && <FilterPanel />}
        {sidePanelTab === 'details' && (
          selectedObjectId ? (
            <ObjectDetails objectId={selectedObjectId} objectType={selectedObjectType!} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Info className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">点击场景中的对象查看详情</p>
            </div>
          )
        )}
      </div>

      <div className="border-t border-slate-700 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Database className="w-3.5 h-3.5" />
          <span>数据来源: 箱位模型、吊机任务、卡车路线等6个文件</span>
        </div>
      </div>
    </div>
  );
}
