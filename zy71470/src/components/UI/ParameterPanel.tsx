import { useState } from 'react';
import { RotateCcw, Plus, Download, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { useFilmStore } from '@/store/useFilmStore';
import { ParameterSlider } from './ParameterSlider';
import { mediumRefractiveIndices } from '@/data/cieData';
import type { FilmParams } from '@/types';

const PRESETS = [
  { name: '肥皂泡 (水膜)', thickness: 300, refractiveIndex: 1.333 },
  { name: '增透膜 (MgF2)', thickness: 100, refractiveIndex: 1.38 },
  { name: '二氧化硅薄膜', thickness: 150, refractiveIndex: 1.46 },
  { name: '二氧化钛薄膜', thickness: 80, refractiveIndex: 2.45 },
  { name: '金刚石薄膜', thickness: 50, refractiveIndex: 2.417 },
];

export const ParameterPanel = () => {
  const { params, updateParam, setParams, resetToDefault, addComparisonGroup, exportResult, setSpectrumStep, spectrumStep } =
    useFilmStore();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  const handleAngleUnitToggle = () => {
    const currentUnit = params.angleUnit;
    const newUnit = currentUnit === 'degree' ? 'radian' : 'degree';
    
    let newAngle = params.incidentAngle;
    if (currentUnit === 'degree') {
      newAngle = (params.incidentAngle * Math.PI) / 180;
    } else {
      newAngle = (params.incidentAngle * 180) / Math.PI;
    }
    
    setParams({
      angleUnit: newUnit,
      incidentAngle: newAngle,
    } as Partial<FilmParams>);
  };

  const handlePresetSelect = (preset: typeof PRESETS[0]) => {
    setParams({
      thickness: preset.thickness,
      refractiveIndex: preset.refractiveIndex,
    } as Partial<FilmParams>);
    setShowPresets(false);
  };

  const handleExport = () => {
    const data = exportResult();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `film-interference-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddToCompare = () => {
    const name = `实验 ${new Date().toLocaleTimeString()}`;
    addComparisonGroup(name);
  };

  const angleMax = params.angleUnit === 'degree' ? 89 : 1.55;
  const angleStep = params.angleUnit === 'degree' ? 1 : 0.01;

  return (
    <div className="h-full flex flex-col bg-slate-900/90 backdrop-blur-sm border-r border-slate-700">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-bold text-white mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          参数控制
        </h2>
        <p className="text-xs text-gray-400">调节薄膜参数，观察干涉颜色变化</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-cyan-400 rounded-full" />
            预设实验
          </h3>
          <div className="relative">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="w-full px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-left text-gray-300 flex items-center justify-between transition-colors"
            >
              <span>选择预设实验</span>
              {showPresets ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showPresets && (
              <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600 rounded shadow-xl">
                {PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePresetSelect(preset)}
                    className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-slate-700 first:rounded-t last:rounded-b transition-colors"
                  >
                    <div className="font-medium">{preset.name}</div>
                    <div className="text-xs text-gray-500">
                      d={preset.thickness}nm, n={preset.refractiveIndex}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-cyan-400 rounded-full" />
            薄膜参数
          </h3>
          
          <ParameterSlider
            label="薄膜厚度"
            value={params.thickness}
            min={0}
            max={2000}
            step={1}
            unit="nm"
            onChange={(v) => updateParam('thickness', v)}
            description="薄膜的物理厚度，直接影响光程差和干涉条件。肥皂泡典型厚度：100-1000nm"
          />

          <ParameterSlider
            label="薄膜折射率"
            value={params.refractiveIndex}
            min={1.0}
            max={3.0}
            step={0.01}
            unit=""
            onChange={(v) => updateParam('refractiveIndex', v)}
            description="薄膜材料的折射率。空气n=1.0，水n=1.33，玻璃n=1.5，金刚石n=2.42"
          />

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-300">常用材料</label>
            </div>
            <select
              value={params.refractiveIndex}
              onChange={(e) => updateParam('refractiveIndex', parseFloat(e.target.value))}
              className="w-full px-3 py-1.5 text-sm bg-slate-800/50 border border-slate-600 rounded text-gray-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">选择材料...</option>
              {mediumRefractiveIndices.map((m, idx) => (
                <option key={idx} value={m.refractiveIndex}>
                  {m.name} (n={m.refractiveIndex})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-cyan-400 rounded-full" />
            入射光参数
          </h3>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-300">入射角</label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={params.incidentAngle.toFixed(params.angleUnit === 'degree' ? 0 : 4)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      updateParam('incidentAngle', val);
                    }
                  }}
                  className="w-20 px-2 py-1 text-sm bg-slate-800/50 border border-slate-600 rounded text-right text-gray-200 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleAngleUnitToggle}
                  className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 border border-slate-500 rounded text-gray-300 transition-colors"
                >
                  {params.angleUnit === 'degree' ? '°' : 'rad'}
                </button>
              </div>
            </div>
            <div className="relative h-2">
              <div className="absolute inset-0 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-green-400 rounded-full transition-all duration-100"
                  style={{ width: `${(params.incidentAngle / angleMax) * 100}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={angleMax}
                step={angleStep}
                value={params.incidentAngle}
                onChange={(e) => updateParam('incidentAngle', parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>0</span>
              <span>{angleMax}{params.angleUnit === 'degree' ? '°' : 'rad'}</span>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-300 mb-1 block">偏振态</label>
            <div className="flex gap-2">
              {(['s', 'p', 'unpolarized'] as const).map((pol) => (
                <button
                  key={pol}
                  onClick={() => updateParam('polarization', pol)}
                  className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                    params.polarization === pol
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-800/50 border-slate-600 text-gray-400 hover:border-slate-500'
                  }`}
                >
                  {pol === 's' ? 's波' : pol === 'p' ? 'p波' : '自然光'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-sm font-semibold text-cyan-400 mb-3"
          >
            <span className="flex items-center gap-2">
              <Settings size={16} />
              高级设置
            </span>
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showAdvanced && (
            <div className="space-y-4 p-3 bg-slate-800/50 rounded border border-slate-700">
              <ParameterSlider
                label="波长范围 (最小)"
                value={params.wavelengthRange.min}
                min={300}
                max={800}
                step={5}
                unit="nm"
                onChange={(v) => updateParam('wavelengthRange', { ...params.wavelengthRange, min: v })}
                description="光谱计算的最短波长。可见光范围：380-780nm"
              />
              <ParameterSlider
                label="波长范围 (最大)"
                value={params.wavelengthRange.max}
                min={300}
                max={800}
                step={5}
                unit="nm"
                onChange={(v) => updateParam('wavelengthRange', { ...params.wavelengthRange, max: v })}
                description="光谱计算的最长波长。可见光范围：380-780nm"
              />
              <ParameterSlider
                label="基板折射率"
                value={params.substrateN}
                min={1.0}
                max={3.0}
                step={0.01}
                unit=""
                onChange={(v) => updateParam('substrateN', v)}
                description="薄膜下方基板材料的折射率。普通玻璃：1.52"
              />
              <ParameterSlider
                label="环境折射率"
                value={params.ambientN}
                min={1.0}
                max={2.0}
                step={0.01}
                unit=""
                onChange={(v) => updateParam('ambientN', v)}
                description="薄膜上方环境介质的折射率。空气：1.0，水：1.33"
              />
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">光谱采样步长</label>
                <div className="flex gap-2">
                  {[1, 5, 10].map((step) => (
                    <button
                      key={step}
                      onClick={() => setSpectrumStep(step)}
                      className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                        spectrumStep === step
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                          : 'bg-slate-800/50 border-slate-600 text-gray-400 hover:border-slate-500'
                      }`}
                    >
                      {step}nm {step === 1 ? '(高精度)' : step === 5 ? '(平衡)' : '(快速)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-700 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleAddToCompare}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
          >
            <Plus size={16} />
            加入对比
          </button>
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-gray-200 rounded transition-colors"
          >
            <Download size={16} />
            导出数据
          </button>
        </div>
        <button
          onClick={resetToDefault}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-600 text-gray-300 rounded transition-colors"
        >
          <RotateCcw size={16} />
          重置参数
        </button>
      </div>
    </div>
  );
};
