
import { GitCompare, Clock, User } from 'lucide-react';
import { useModelStore } from '../../store/useModelStore';

export function VersionTimeline() {
  const { versions, currentVersion, compareVersion, setCurrentVersion, setCompareVersion, loaded } = useModelStore();

  if (!loaded) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 flex items-center px-4 z-10">
      <div className="flex items-center gap-4 flex-1">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-blue-400" />
          <span className="text-xs text-slate-400">版本</span>
        </div>

        <div className="flex items-center gap-2">
          {versions.map((v) => (
            <button
              key={v.version}
              onClick={() => {
                if (compareVersion === v.version) {
                  setCompareVersion(null);
                } else if (currentVersion !== v.version) {
                  if (compareVersion === null) {
                    setCompareVersion(v.version);
                  } else {
                    setCurrentVersion(v.version);
                  }
                }
              }}
              className={`relative px-3 py-1.5 rounded text-xs font-medium transition-all ${
                currentVersion === v.version
                  ? 'bg-blue-600 text-white'
                  : compareVersion === v.version
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              V{v.version}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 px-2 py-1 rounded text-[10px] whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-20">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {v.author}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(v.timestamp).toLocaleDateString('zh-CN')}
                </div>
              </div>
            </button>
          ))}
        </div>

        {compareVersion !== null && (
          <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-purple-500/20 rounded border border-purple-500/30">
            <GitCompare className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-purple-300">
              对比模式: V{currentVersion} vs V{compareVersion}
            </span>
            <button
              onClick={() => setCompareVersion(null)}
              className="ml-1 text-purple-400 hover:text-purple-300"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>单位: 米</span>
        <span>|</span>
        <span>楼层: B1</span>
      </div>
    </div>
  );
}
