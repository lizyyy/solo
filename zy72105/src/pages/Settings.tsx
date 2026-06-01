import { useAppStore } from '../store/useAppStore';
import { DEFAULT_THRESHOLD_CONFIG } from '../types';
import { Settings as SettingsIcon, Save, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { ThresholdConfig } from '../types';

export const Settings = () => {
  const { thresholdConfig, updateThresholdConfig } = useAppStore();
  const [config, setConfig] = useState<ThresholdConfig>({ ...thresholdConfig });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateThresholdConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setConfig({ ...DEFAULT_THRESHOLD_CONFIG });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">阈值配置</h2>
          <p className="text-slate-500 text-sm mt-1">噪声阈值、时间间隔阈值、容差范围</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            恢复默认
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all shadow-md ${
              saved
                ? 'bg-green-600 text-white shadow-green-600/20'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'
            }`}
          >
            <Save className="w-4 h-4" />
            {saved ? '已保存' : '保存配置'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">阈值参数配置</h3>
              <p className="text-slate-300 text-sm">修改后需保存生效，影响后续计算和校验</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              噪声阈值
            </h4>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  警告阈值 (dB)
                </label>
                <input
                  type="number"
                  value={config.noiseWarning}
                  onChange={(e) => setConfig({ ...config, noiseWarning: Number(e.target.value) })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">噪声超过此值将触发警告提醒</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  临界阈值 (dB)
                </label>
                <input
                  type="number"
                  value={config.noiseCritical}
                  onChange={(e) => setConfig({ ...config, noiseCritical: Number(e.target.value) })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">噪声超过此值将触发严重警告，建议停飞</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full" />
              时间间隔阈值
            </h4>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  警告阈值 (秒)
                </label>
                <input
                  type="number"
                  value={config.timeGapWarning}
                  onChange={(e) => setConfig({ ...config, timeGapWarning: Number(e.target.value) })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">数据时间间隔超过此值触发警告</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  临界阈值 (秒)
                </label>
                <input
                  type="number"
                  value={config.timeGapCritical}
                  onChange={(e) => setConfig({ ...config, timeGapCritical: Number(e.target.value) })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">数据时间间隔超过此值触发严重警告</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full" />
              数值容差与方向检查
            </h4>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  数值容差 (%)
                </label>
                <input
                  type="number"
                  value={config.valueTolerance}
                  onChange={(e) => setConfig({ ...config, valueTolerance: Number(e.target.value) })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">传感器与导入数据差异超过此百分比触发冲突</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  方向符号检查
                </label>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => setConfig({ ...config, directionMismatch: true })}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      config.directionMismatch
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    启用
                  </button>
                  <button
                    onClick={() => setConfig({ ...config, directionMismatch: false })}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      !config.directionMismatch
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    禁用
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">启用后将检查方向符号一致性（如CW/CCW）</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
