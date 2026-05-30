import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GitCompare, Info, Beaker } from 'lucide-react';
import { useFilmStore } from '@/store/useFilmStore';
import { FilmScene } from '@/components/Scene3D/FilmScene';
import { ParameterPanel } from '@/components/UI/ParameterPanel';
import { ResultPanel } from '@/components/UI/ResultPanel';
import { ComparisonPanel } from '@/components/UI/ComparisonPanel';
import { ENGINE_VERSION } from '@/data/cieData';

export const Workbench = () => {
  const { params, result, comparisonGroups } = useFilmStore();
  const [showComparison, setShowComparison] = useState(false);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden">
      <header className="h-14 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Beaker className="text-white" size={18} />
          </div>
          <div>
            <h1
              className="text-lg font-bold text-white leading-tight"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              薄膜干涉颜色计算
            </h1>
            <p className="text-xs text-gray-500 leading-tight">
              交互式 3D 物理实验工作台
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowComparison(true)}
            className="relative flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-gray-300 transition-colors"
          >
            <GitCompare size={16} />
            对比实验室
            {comparisonGroups.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {comparisonGroups.length}
              </span>
            )}
          </button>
          <Link
            to="/about"
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-gray-300 transition-colors"
          >
            <Info size={16} />
            关于
          </Link>
          <span className="text-xs text-gray-600 font-mono ml-2">
            v{ENGINE_VERSION}
          </span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 flex-shrink-0 overflow-hidden">
          <ParameterPanel />
        </aside>

        <main className="flex-1 relative overflow-hidden">
          {result && (
            <FilmScene params={params} reflectedColor={result.reflectedColor} />
          )}

          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
            <div className="px-3 py-2 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 pointer-events-auto">
              <div className="text-xs text-gray-400">当前参数</div>
              <div className="text-sm font-mono text-cyan-400">
                d={params.thickness.toFixed(0)}nm · n={params.refractiveIndex.toFixed(2)} · θ=
                {params.incidentAngle.toFixed(1)}
                {params.angleUnit === 'degree' ? '°' : 'rad'}
              </div>
            </div>
            <div className="px-3 py-2 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700 text-xs text-gray-500 pointer-events-auto">
              拖拽旋转 · 滚轮缩放
            </div>
          </div>

          {result && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/80 backdrop-blur-sm rounded-full border border-slate-700 flex items-center gap-3">
              <div
                className="w-6 h-6 rounded-full border border-slate-600"
                style={{
                  backgroundColor: `rgb(${Math.round(result.reflectedColor.r * 255)}, ${Math.round(
                    result.reflectedColor.g * 255
                  )}, ${Math.round(result.reflectedColor.b * 255)})`,
                }}
              />
              <span className="text-sm font-mono text-gray-300">
                主波长: {result.dominantWavelength || '-'} nm
              </span>
            </div>
          )}
        </main>

        <aside className="w-96 flex-shrink-0 overflow-hidden">
          <ResultPanel />
        </aside>
      </div>

      {showComparison && <ComparisonPanel onClose={() => setShowComparison(false)} />}
    </div>
  );
};
