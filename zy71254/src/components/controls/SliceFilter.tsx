import { Layers, AlertTriangle, Tag, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export const SliceFilter = () => {
  const {
    slices, filterErrorsOnly, filterAnnotatedOnly, setFilterErrorsOnly, setFilterAnnotatedOnly, toggleSliceVisibility, selectedSliceId, selectSlice } = useAppStore();

  const errorCount = slices.filter((s) => s.hasError).length;
  const annotatedCount = slices.filter((s) => s.id).length;

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-4 border border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-cyan-400" />
        <h3 className="text-cyan-400 font-semibold text-sm">切片筛选</h3>
      </div>

      <div className="space-y-2 mb-4">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={filterErrorsOnly}
            onChange={(e) => setFilterErrorsOnly(e.target.checked)}
            className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
          />
          <span className="text-slate-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            仅显示有错误的切片
            <span className="text-slate-500 text-xs">({errorCount})</span>
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={filterAnnotatedOnly}
            onChange={(e) => setFilterAnnotatedOnly(e.target.checked)}
            className="rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
          />
          <span className="text-slate-300 text-sm flex items-center gap-2">
            <Tag className="w-3 h-3 text-cyan-400" />
            仅显示有标注的切片
            <span className="text-slate-500 text-xs">({annotatedCount})</span>
          </span>
        </label>
      </div>

      <div className="border-t border-slate-700 pt-4">
        <div className="text-slate-400 text-xs mb-2">切片列表</div>
        <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
          {slices.map((slice) => {
            const hasAnnotations = useAppStore.getState().annotations.filter((a) => a.sliceId === slice.id).length > 0;
            return (
              <div
                key={slice.id}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                  selectedSliceId === slice.id
                    ? 'bg-cyan-500/20 border border-cyan-500/50'
                    : 'bg-slate-700/50 hover:bg-slate-700'
                } ${slice.hasError ? 'border-l-2 border-red-500' : ''}`}
                onClick={() => selectSlice(slice.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-300 text-xs font-mono">
                    #{slice.index.toString().padStart(2, '0')}
                  </span>
                  {slice.hasError && (
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                  )}
                  {hasAnnotations && (
                    <Tag className="w-3 h-3 text-cyan-400" />
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSliceVisibility(slice.id);
                  }}
                  className="text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  {slice.isVisible ? (
                    <Eye className="w-3 h-3" />
                  ) : (
                    <EyeOff className="w-3 h-3" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
