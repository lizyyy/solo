import { Settings, RotateCcw, Zap } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { COORDINATE_SYSTEMS } from '@/types';

export function ParamPanel() {
  const { params, setParams, detectAnomalies, currentOperator } = useStore();

  const handleParamChange = (key: keyof typeof params, value: number | string | boolean) => {
    setParams({ [key]: value }, `调整${key}参数`);
  };

  const handleReset = () => {
    setParams(
      {
        frequencyMin: 20,
        frequencyMax: 20000,
        sampleRate: 48000,
        soundFieldThreshold: 75,
        coordinateSystem: 'CGCS2000',
        autoDetect: true,
      },
      '重置所有参数为默认值'
    );
  };

  const handleDetect = () => {
    detectAnomalies();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-primary-700 font-serif flex items-center gap-2">
          <Settings className="w-5 h-5" />
          参数配置
        </h3>
        <div className="text-xs text-gray-500">
          当前操作人: <span className="font-medium text-primary-600">{currentOperator}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="flex items-center justify-between text-sm font-medium text-gray-700">
            <span>频率范围 (Hz)</span>
            <span className="text-xs text-gray-500">
              {params.frequencyMin} - {params.frequencyMax}
            </span>
          </label>
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="range"
                min="20"
                max="1000"
                value={params.frequencyMin}
                onChange={(e) => handleParamChange('frequencyMin', Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
              <div className="text-xs text-gray-400 mt-1">最低频率</div>
            </div>
            <div className="flex-1">
              <input
                type="range"
                min="5000"
                max="40000"
                step="1000"
                value={params.frequencyMax}
                onChange={(e) => handleParamChange('frequencyMax', Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
              <div className="text-xs text-gray-400 mt-1">最高频率</div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center justify-between text-sm font-medium text-gray-700">
            <span>采样精度 (Hz)</span>
            <span className="text-xs text-gray-500">{params.sampleRate.toLocaleString()}</span>
          </label>
          <select
            value={params.sampleRate}
            onChange={(e) => handleParamChange('sampleRate', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all"
          >
            <option value={44100}>44,100 Hz (CD质量)</option>
            <option value={48000}>48,000 Hz (专业音频)</option>
            <option value={96000}>96,000 Hz (高清音频)</option>
            <option value={192000}>192,000 Hz (母带级)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="flex items-center justify-between text-sm font-medium text-gray-700">
            <span>声场阈值 (dB)</span>
            <span className="text-xs text-gray-500">{params.soundFieldThreshold} dB</span>
          </label>
          <input
            type="range"
            min="50"
            max="110"
            value={params.soundFieldThreshold}
            onChange={(e) => handleParamChange('soundFieldThreshold', Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>50 (安静)</span>
            <span>80 (适中)</span>
            <span>110 (响亮)</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">主坐标系</label>
          <select
            value={params.coordinateSystem}
            onChange={(e) => handleParamChange('coordinateSystem', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all"
          >
            {COORDINATE_SYSTEMS.map((sys) => (
              <option key={sys} value={sys}>
                {sys}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            非主坐标系的点位将被标注，不硬画到主坐标系空间
          </p>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">自动检测异常</label>
          <button
            onClick={() => handleParamChange('autoDetect', !params.autoDetect)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              params.autoDetect ? 'bg-primary-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                params.autoDetect ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 flex gap-2">
        <button
          onClick={handleDetect}
          className="btn btn-primary flex-1 flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          重新检测
        </button>
        <button
          onClick={handleReset}
          className="btn btn-outline flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          重置
        </button>
      </div>

      <div className="mt-4 p-3 bg-primary-50 rounded-lg border border-primary-100">
        <div className="text-xs text-primary-700 font-medium mb-1">参数变更说明</div>
        <p className="text-xs text-primary-600">
          参数修改后，场景图、明细列表、报告将实时同步更新，确保数据一致性。
        </p>
      </div>
    </div>
  );
}
