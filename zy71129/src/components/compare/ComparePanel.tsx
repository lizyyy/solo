
import { useModelStore } from '../../store/useModelStore';
import { getChangeColor, getChangeLabel } from '../../utils/versionDiff';
import { X, RefreshCw, SplitSquareHorizontal, Layers, Eye, EyeOff } from 'lucide-react';

export function ComparePanel() {
  const { 
    compareView, 
    versionDiff, 
    setCompareViewMode,
    setSyncViews,
    setHighlightDiff,
    disableCompareMode,
    versions,
    currentVersion,
    compareVersion
  } = useModelStore();

  const currentVersionInfo = versions.find(v => v.number === currentVersion);
  const compareVersionInfo = versions.find(v => v.number === compareVersion);

  if (!compareView.enabled) return null;

  return (
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
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                compareView.viewMode === 'sideBySide' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title="并排视图"
            >
              <SplitSquareHorizontal className="w-3 h-3" />
              <span className="hidden sm:inline">并排</span>
            </button>
            <button
              onClick={() => setCompareViewMode('overlay')}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                compareView.viewMode === 'overlay' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title="叠加视图"
            >
              <Layers className="w-3 h-3" />
              <span className="hidden sm:inline">叠加</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-600" />

          <button
            onClick={() => setSyncViews(!compareView.syncViews)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              compareView.syncViews 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title="同步视角"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">同步</span>
          </button>

          <button
            onClick={() => setHighlightDiff(!compareView.highlightDiff)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              compareView.highlightDiff 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title="差异高亮"
          >
            {compareView.highlightDiff ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">高亮</span>
          </button>
        </div>

        {versionDiff && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs">
              <span 
                className="w-3 h-3 rounded" 
                style={{ backgroundColor: getChangeColor('added') }}
              />
              <span className="text-slate-300">新增 {versionDiff.statistics.added}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span 
                className="w-3 h-3 rounded" 
                style={{ backgroundColor: getChangeColor('removed') }}
              />
              <span className="text-slate-300">删除 {versionDiff.statistics.removed}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span 
                className="w-3 h-3 rounded" 
                style={{ backgroundColor: getChangeColor('modified') }}
              />
              <span className="text-slate-300">修改 {versionDiff.statistics.modified}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span 
                className="w-3 h-3 rounded" 
                style={{ backgroundColor: getChangeColor('unchanged') }}
              />
              <span className="text-slate-300">未变 {versionDiff.statistics.unchanged}</span>
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
  );
}
