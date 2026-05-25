
import { useState } from 'react';
import { useModelStore } from '../../store/useModelStore';
import { getChangeColor, getChangeLabel } from '../../utils/versionDiff';
import { X, RefreshCw, SplitSquareHorizontal, Layers, Eye, EyeOff, ChevronDown, ChevronRight, List } from 'lucide-react';

export function ComparePanel() {
  const [showChangeList, setShowChangeList] = useState(false);
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());
  
  const { 
    compareView, 
    versionDiff, 
    setCompareViewMode,
    setSyncViews,
    setHighlightDiff,
    disableCompareMode,
    currentVersion,
    compareVersion,
    setSelectedElement
  } = useModelStore();

  const toggleChangeExpand = (id: string) => {
    setExpandedChanges(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleElementClick = (elementId: string) => {
    setSelectedElement(elementId);
  };

  if (!compareView.enabled) return null;

  const filteredChanges = versionDiff?.changes.filter(c => c.type !== 'unchanged') || [];

  return (
    <>
      <div className="absolute top-14 left-0 right-0 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700 px-4 py-2 z-20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">对比模式</span>
              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded">
                V{compareVersion} → V{currentVersion}
              </span>
            </div>

            <div className="h-4 w-px bg-slate-600" />

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCompareViewMode('sideBySide')}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${compareView.viewMode === 'sideBySide' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                title="并排视图"
              >
                <SplitSquareHorizontal className="w-3 h-3" />
                <span className="hidden sm:inline">并排</span>
              </button>
              <button
                onClick={() => setCompareViewMode('overlay')}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${compareView.viewMode === 'overlay' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                title="叠加视图"
              >
                <Layers className="w-3 h-3" />
                <span className="hidden sm:inline">叠加</span>
              </button>
            </div>

            <div className="h-4 w-px bg-slate-600" />

            <button
              onClick={() => setSyncViews(!compareView.syncViews)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${compareView.syncViews ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              title="同步视角"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">同步</span>
            </button>

            <button
              onClick={() => setHighlightDiff(!compareView.highlightDiff)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${compareView.highlightDiff ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              title="差异高亮"
            >
              {compareView.highlightDiff ? (
                <Eye className="w-3 h-3" />
              ) : (
                <EyeOff className="w-3 h-3" />
              )}
              <span className="hidden sm:inline">高亮</span>
            </button>

            <button
              onClick={() => setShowChangeList(!showChangeList)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${showChangeList ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              title="变更记录"
            >
              <List className="w-3 h-3" />
              <span className="hidden sm:inline">变更</span>
              {versionDiff && filteredChanges.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white rounded-full text-[10px]">
                  {filteredChanges.length}
                </span>
              )}
            </button>
          </div>

          {versionDiff && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: getChangeColor('added') }} />
                <span className="text-slate-300">新增 {versionDiff.statistics.added}</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: getChangeColor('removed') }} />
                <span className="text-slate-300">删除 {versionDiff.statistics.removed}</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: getChangeColor('modified') }} />
                <span className="text-slate-300">修改 {versionDiff.statistics.modified}</span>
              </div>
            </div>
          )}

          <button
            onClick={disableCompareMode}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="退出对比模式"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showChangeList && versionDiff && (
        <div className="absolute top-28 left-4 bottom-20 w-80 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl z-25 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">变更记录</h3>
            <span className="text-xs text-slate-400">
              共 {filteredChanges.length} 项变更
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {filteredChanges.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                暂无变更记录
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {filteredChanges.map((change) => (
                  <div key={change.elementId} className="hover:bg-slate-800/50">
                    <div className="px-4 py-3 cursor-pointer" onClick={() => toggleChangeExpand(change.elementId)}>
                      <div className="flex items-center gap-2">
                        {expandedChanges.has(change.elementId) ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                        <span className="px-1.5 py-0.5 text-[10px] rounded font-medium" style={{ backgroundColor: `${getChangeColor(change.type)}20`, color: getChangeColor(change.type) }}>
                          {getChangeLabel(change.type)}
                        </span>
                        <span className="text-sm text-white truncate flex-1" onClick={(e) => {
                          e.stopPropagation();
                          handleElementClick(change.elementId);
                        }}>
                          {change.newElement?.name || change.oldElement?.name || change.elementId}
                        </span>
                      </div>
                    </div>
                    
                    {expandedChanges.has(change.elementId) && change.changes && change.changes.length > 0 && (
                      <div className="px-4 pb-3 pl-10">
                        <div className="space-y-2">
                          {change.changes.map((c, idx) => (
                            <div key={idx} className="text-xs">
                              <span className="text-slate-400">{c.property}:</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-red-400 line-through">{String(c.oldValue)}</span>
                                <span className="text-slate-500">→</span>
                                <span className="text-green-400">{String(c.newValue)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
