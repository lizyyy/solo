import { Box } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export const ThicknessControl = () => {
  const { sliceSpacing, setSliceSpacing, selectedSliceId, slices } = useAppStore();
  const selectedSlice = slices.find((s) => s.id === selectedSliceId);

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-4 border border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <Box className="w-4 h-4 text-cyan-400" />
        <h3 className="text-cyan-400 font-semibold text-sm">层厚与间距</h3>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-slate-400 text-xs">3D视图间距</label>
            <span className="text-cyan-400 font-mono text-xs">{sliceSpacing.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="0.5"
            step="0.01"
            value={sliceSpacing}
            onChange={(e) => setSliceSpacing(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>紧凑</span>
            <span>疏松</span>
          </div>
        </div>

        {selectedSlice && (
          <div className="border-t border-slate-700 pt-4">
            <div className="text-slate-400 text-xs mb-2">当前切片信息</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">切片编号</span>
                <span className="text-slate-300 font-mono">#{selectedSlice.index.toString().padStart(2, '0')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">原始层厚</span>
                <span className="text-slate-300 font-mono">{selectedSlice.sliceThickness} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">窗宽/窗位</span>
                <span className="text-slate-300 font-mono">{selectedSlice.windowWidth}/{selectedSlice.windowCenter}</span>
              </div>
              {selectedSlice.hasError && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="text-red-400 font-medium mb-1">检测到问题</div>
                  <div className="text-red-300/80 text-xs">{selectedSlice.errorNote}</div>
                  <div className="mt-2">
                    <span className="inline-block px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">
                      {selectedSlice.errorType}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
