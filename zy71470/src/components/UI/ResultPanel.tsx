import { BlockMath } from 'react-katex';
import { Eye, Layers, Waves, ThermometerSun, Hash, ArrowRightLeft, Info } from 'lucide-react';
import { useMemo } from 'react';
import { useFilmStore } from '@/store/useFilmStore';
import { rgbToHex } from '@/utils/interferenceEngine';
import { SpectrumChart } from './SpectrumChart';
import { WarningPanel } from './WarningPanel';
import { ENGINE_VERSION } from '@/data/cieData';

export const ResultPanel = () => {
  const { result, warnings, hasErrors, params } = useFilmStore();

  const colorHex = useMemo(() => {
    return result ? rgbToHex(result.reflectedColor) : '#000000';
  }, [result]);

  const rgbValues = useMemo(() => {
    if (!result) return { r: 0, g: 0, b: 0 };
    return {
      r: Math.round(result.reflectedColor.r * 255),
      g: Math.round(result.reflectedColor.g * 255),
      b: Math.round(result.reflectedColor.b * 255),
    };
  }, [result]);

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900/90 backdrop-blur-sm border-l border-slate-700">
        <div className="text-center text-gray-400">
          <Eye size={48} className="mx-auto mb-4 opacity-30" />
          <p>调整参数以查看计算结果</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900/90 backdrop-blur-sm border-l border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            计算结果
          </h2>
          <span className="text-xs text-gray-500 font-mono">
            v{ENGINE_VERSION}
          </span>
        </div>
        {hasErrors && (
          <p className="text-xs text-red-400 mt-1">
            ⚠️ 参数存在错误，计算结果可能不准确
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <Eye size={16} />
            反射光颜色
          </h3>
          <div className="flex gap-4">
            <div
              className="w-24 h-24 rounded-lg border-2 border-slate-600 shadow-lg flex-shrink-0"
              style={{
                backgroundColor: colorHex,
                boxShadow: `0 0 30px ${colorHex}40`,
              }}
            />
            <div className="flex-1 space-y-1">
              <div className="text-sm">
                <span className="text-gray-400">HEX: </span>
                <span className="text-white font-mono">{colorHex.toUpperCase()}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-400">RGB: </span>
                <span className="text-white font-mono">
                  ({rgbValues.r}, {rgbValues.g}, {rgbValues.b})
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-400">CIE-XYZ: </span>
                <span className="text-white font-mono text-xs">
                  ({result.xyz.x.toFixed(4)}, {result.xyz.y.toFixed(4)}, {result.xyz.z.toFixed(4)})
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <Waves size={16} />
            光谱反射率曲线
          </h3>
          <div className="h-48 bg-slate-800/50 rounded-lg border border-slate-700 p-2">
            <SpectrumChart
              spectrum={result.spectrum}
              dominantWavelength={result.dominantWavelength}
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <Layers size={16} />
            关键计算数值
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                <ArrowRightLeft size={12} />
                光程差
              </div>
              <div className="text-lg font-mono text-white">
                {result.opticalPathDiff.toFixed(1)}
                <span className="text-xs text-gray-400 ml-1">nm</span>
              </div>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                <Hash size={12} />
                干涉级次
              </div>
              <div className="text-lg font-mono text-white">
                {result.interferenceOrder}
                <span className="text-xs text-gray-400 ml-1">级</span>
              </div>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                <Waves size={12} />
                主波长
              </div>
              <div className="text-lg font-mono text-white">
                {result.dominantWavelength || '-'}
                <span className="text-xs text-gray-400 ml-1">nm</span>
              </div>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                <ThermometerSun size={12} />
                相关色温
              </div>
              <div className="text-lg font-mono text-white">
                {result.colorTemperature > 0 ? result.colorTemperature : '-'}
                <span className="text-xs text-gray-400 ml-1">K</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <Info size={16} />
            干涉公式
          </h3>
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 overflow-x-auto">
            <div className="text-xs text-gray-400 mb-2">多光束干涉反射系数:</div>
            <BlockMath math="r = \frac{r_{12} + r_{23} e^{-i\delta}}{1 + r_{12} r_{23} e^{-i\delta}}" />
            <div className="text-xs text-gray-400 mt-3 mb-2">相位差:</div>
            <BlockMath math="\delta = \frac{4\pi}{\lambda} n_2 d \cos\theta_2" />
            <div className="text-xs text-gray-400 mt-3 mb-2">当前参数:</div>
            <div className="text-xs font-mono text-gray-300 space-y-1">
              <div>n₁ (环境) = {params.ambientN.toFixed(3)}</div>
              <div>n₂ (薄膜) = {params.refractiveIndex.toFixed(3)}</div>
              <div>n₃ (基板) = {params.substrateN.toFixed(3)}</div>
              <div>d = {params.thickness.toFixed(1)} nm</div>
              <div>θ₁ = {params.incidentAngle.toFixed(1)} {params.angleUnit === 'degree' ? '°' : 'rad'}</div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-cyan-400 mb-3">参数验证</h3>
          <WarningPanel warnings={warnings} />
        </div>
      </div>
    </div>
  );
};
