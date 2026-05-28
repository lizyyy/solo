import { useState } from 'react';
import { useView3DStore } from '@/store/useView3DStore';
import { Scissors, X } from 'lucide-react';

export const SectionController = () => {
  const { sectionPlane, setSectionPlane } = useView3DStore();
  const [isOpen, setIsOpen] = useState(false);

  const axisLabels = {
    x: 'X轴 (横向)',
    y: 'Y轴 (纵向)',
    z: 'Z轴 (深度)'
  };

  const handleAxisChange = (axis: 'x' | 'y' | 'z' | null) => {
    if (axis === null) {
      setSectionPlane(null, 0);
    } else {
      setSectionPlane(axis, sectionPlane.axis === axis ? sectionPlane.position : 0);
    }
  };

  const handlePositionChange = (value: number) => {
    if (sectionPlane.axis) {
      setSectionPlane(sectionPlane.axis, value);
    }
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
      <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden">
        <div
          className="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-slate-800/50 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Scissors className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-medium text-slate-200">剖面切割</span>
          {sectionPlane.axis && (
            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
              {axisLabels[sectionPlane.axis]}
            </span>
          )}
        </div>

        {isOpen && (
          <div className="border-t border-slate-700/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <button
                  key={axis}
                  onClick={() => handleAxisChange(axis)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                    sectionPlane.axis === axis
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                  }`}
                >
                  {axis.toUpperCase()}轴
                </button>
              ))}
              <button
                onClick={() => handleAxisChange(null)}
                className="ml-auto p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                title="关闭剖面"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {sectionPlane.axis && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-8">-2</span>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={sectionPlane.position}
                  onChange={(e) => handlePositionChange(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-xs text-slate-400 w-8">2</span>
                <span className="text-xs text-slate-300 w-12 text-right">
                  {sectionPlane.position.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
