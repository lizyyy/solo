import { X, ArrowRight, Trash2, Copy, Play } from 'lucide-react';
import { useFilmStore } from '@/store/useFilmStore';
import { rgbToHex } from '@/utils/interferenceEngine';
import type { ComparisonGroup } from '@/types';

interface ComparisonPanelProps {
  onClose: () => void;
}

export const ComparisonPanel = ({ onClose }: ComparisonPanelProps) => {
  const { comparisonGroups, removeComparisonGroup, clearComparisonGroups, loadParams, params } =
    useFilmStore();

  const getColorDiff = (group1: ComparisonGroup, group2: ComparisonGroup) => {
    const c1 = group1.result.reflectedColor;
    const c2 = group2.result.reflectedColor;
    const diff = Math.sqrt(
      Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2)
    );
    return (diff / Math.sqrt(3)) * 100;
  };

  const handleCopyParams = (group: ComparisonGroup) => {
    loadParams(group.params);
  };

  if (comparisonGroups.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-8">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              对比实验室
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-8 text-center text-gray-400">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
              <Copy size={32} className="opacity-30" />
            </div>
            <p className="text-lg mb-2">暂无对比数据</p>
            <p className="text-sm opacity-70">
              在主工作台点击"加入对比"按钮，将当前参数和结果添加到对比列表
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-8">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              对比实验室
            </h2>
            <span className="text-sm text-gray-400">
              {comparisonGroups.length} / 4 组实验
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearComparisonGroups}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
              清空全部
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="flex gap-4 mb-6 overflow-x-auto pb-4">
            {comparisonGroups.map((group) => (
              <div
                key={group.id}
                className="flex-shrink-0 w-72 bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden"
              >
                <div className="p-4 border-b border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white">{group.name}</h3>
                    <button
                      onClick={() => removeComparisonGroup(group.id)}
                      className="p-1 hover:bg-slate-700 rounded text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(group.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  <div
                    className="w-full h-24 rounded-lg border border-slate-600"
                    style={{
                      backgroundColor: rgbToHex(group.result.reflectedColor),
                      boxShadow: `0 0 20px ${rgbToHex(group.result.reflectedColor)}40`,
                    }}
                  />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">厚度</span>
                      <span className="text-white font-mono">
                        {group.params.thickness.toFixed(0)} nm
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">折射率</span>
                      <span className="text-white font-mono">
                        {group.params.refractiveIndex.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">入射角</span>
                      <span className="text-white font-mono">
                        {group.params.incidentAngle.toFixed(0)}
                        {group.params.angleUnit === 'degree' ? '°' : 'rad'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">主波长</span>
                      <span className="text-white font-mono">
                        {group.result.dominantWavelength || '-'} nm
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">干涉级次</span>
                      <span className="text-white font-mono">
                        {group.result.interferenceOrder}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">光程差</span>
                      <span className="text-white font-mono">
                        {group.result.opticalPathDiff.toFixed(0)} nm
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopyParams(group)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                  >
                    <Play size={14} />
                    加载此参数
                  </button>
                </div>
              </div>
            ))}

            {comparisonGroups.length < 4 && (
              <div className="flex-shrink-0 w-72 border-2 border-dashed border-slate-600 rounded-xl flex items-center justify-center text-gray-500">
                <div className="text-center p-4">
                  <Copy size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">在工作台点击"加入对比"</p>
                </div>
              </div>
            )}
          </div>

          {comparisonGroups.length >= 2 && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                <ArrowRight size={16} />
                参数差异分析
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {comparisonGroups.slice(1).map((group2, idx) => {
                  const group1 = comparisonGroups[0];
                  const colorDiff = getColorDiff(group1, group2);
                  return (
                    <div key={group2.id} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-10 h-10 rounded-lg border border-slate-600"
                          style={{ backgroundColor: rgbToHex(group1.result.reflectedColor) }}
                        />
                        <ArrowRight size={16} className="text-gray-500" />
                        <div
                          className="w-10 h-10 rounded-lg border border-slate-600"
                          style={{ backgroundColor: rgbToHex(group2.result.reflectedColor) }}
                        />
                        <span className="text-white font-medium">{group1.name} → {group2.name}</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">颜色差异</span>
                          <span
                            className={`font-mono ${
                              colorDiff > 50 ? 'text-red-400' : colorDiff > 20 ? 'text-yellow-400' : 'text-green-400'
                            }`}
                          >
                            {colorDiff.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">厚度变化</span>
                          <span className="text-white font-mono">
                            {group2.params.thickness - group1.params.thickness > 0 ? '+' : ''}
                            {(group2.params.thickness - group1.params.thickness).toFixed(0)} nm
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">折射率变化</span>
                          <span className="text-white font-mono">
                            {group2.params.refractiveIndex - group1.params.refractiveIndex > 0 ? '+' : ''}
                            {(group2.params.refractiveIndex - group1.params.refractiveIndex).toFixed(3)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">入射角变化</span>
                          <span className="text-white font-mono">
                            {group2.params.incidentAngle - group1.params.incidentAngle > 0 ? '+' : ''}
                            {(group2.params.incidentAngle - group1.params.incidentAngle).toFixed(1)}
                            {group1.params.angleUnit === 'degree' ? '°' : 'rad'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">主波长变化</span>
                          <span className="text-white font-mono">
                            {group2.result.dominantWavelength && group1.result.dominantWavelength
                              ? `${
                                  group2.result.dominantWavelength - group1.result.dominantWavelength > 0
                                    ? '+'
                                    : ''
                                }${
                                  group2.result.dominantWavelength - group1.result.dominantWavelength
                                } nm`
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>当前参数:</span>
            <span className="font-mono">
              d={params.thickness.toFixed(0)}nm, n={params.refractiveIndex.toFixed(2)}, θ=
              {params.incidentAngle.toFixed(1)}
              {params.angleUnit === 'degree' ? '°' : 'rad'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
