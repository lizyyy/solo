
import { RotateCcw, Download, Eye, Wind } from 'lucide-react';
import { useState } from 'react';
import { useInspectionStore } from '../../store/useInspectionStore';
import { cameraPresets } from '../../data/mockData';
import { cn } from '../../lib/utils';

interface ToolbarProps {
  onExport: () => void;
}

export function Toolbar({ onExport }: ToolbarProps) {
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const resetState = useInspectionStore((state) => state.resetState);
  const inspectionData = useInspectionStore((state) => state.inspectionData);

  return (
    <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50">
          <Wind className="text-cyan-400" size={24} />
          <div>
            <h1 className="text-lg font-bold text-white">风机叶片巡检标注</h1>
            <p className="text-xs text-slate-400">Wind Turbine Blade Inspection</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {inspectionData && (
          <>
            <div className="relative">
              <button
                onClick={() => setViewMenuOpen(!viewMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 hover:bg-slate-800/80 transition-colors text-slate-200"
              >
                <Eye size={18} />
                <span className="text-sm">视角</span>
              </button>

              {viewMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setViewMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-40 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700/50 py-2 z-20">
                    {cameraPresets.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setViewMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={resetState}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 hover:bg-slate-800/80 transition-colors text-slate-200"
            >
              <RotateCcw size={18} />
              <span className="text-sm">重置</span>
            </button>
          </>
        )}

        <button
          onClick={onExport}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
            inspectionData
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
              : 'bg-slate-700/50 text-slate-400 cursor-not-allowed'
          )}
          disabled={!inspectionData}
        >
          <Download size={18} />
          <span className="text-sm">导出报告</span>
        </button>
      </div>
    </div>
  );
}
