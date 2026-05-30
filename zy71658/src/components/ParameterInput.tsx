
import type { BalloonParams } from '../types';

interface ParameterInputProps {
  params: BalloonParams;
  onChange: (params: BalloonParams) => void;
}

export function ParameterInput({ params, onChange }: ParameterInputProps) {
  const handleChange = (field: keyof BalloonParams, value: string | number | null) => {
    onChange({ ...params, [field]: value });
  };

  const handleNumberChange = (field: keyof BalloonParams, value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    onChange({ ...params, [field]: isNaN(numValue as number) ? null : numValue });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
        <span className="text-2xl">🎈</span>
        实验参数设置
      </h2>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            实验名称
          </label>
          <input
            type="text"
            value={params.experimentName}
            onChange={(e) => handleChange('experimentName', e.target.value)}
            placeholder="例如：三年级2班热气球实验"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🌡️ 气温
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={params.temperature ?? ''}
                onChange={(e) => handleNumberChange('temperature', e.target.value)}
                placeholder="数值"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="text"
                value={params.temperatureUnit}
                onChange={(e) => handleChange('temperatureUnit', e.target.value)}
                placeholder="°C"
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ⚖️ 载重
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={params.payload ?? ''}
                onChange={(e) => handleNumberChange('payload', e.target.value)}
                placeholder="数值"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="text"
                value={params.payloadUnit}
                onChange={(e) => handleChange('payloadUnit', e.target.value)}
                placeholder="kg"
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              💨 风速
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={params.windSpeed ?? ''}
                onChange={(e) => handleNumberChange('windSpeed', e.target.value)}
                placeholder="数值"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="text"
                value={params.windSpeedUnit}
                onChange={(e) => handleChange('windSpeedUnit', e.target.value)}
                placeholder="m/s"
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📦 气囊体积
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={params.balloonVolume ?? ''}
                onChange={(e) => handleNumberChange('balloonVolume', e.target.value)}
                placeholder="数值"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="text"
                value={params.volumeUnit}
                onChange={(e) => handleChange('volumeUnit', e.target.value)}
                placeholder="m³"
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📝 安全备注
          </label>
          <textarea
            value={params.safetyNotes}
            onChange={(e) => handleChange('safetyNotes', e.target.value)}
            placeholder="记录实验地点、人员分工、特殊注意事项等..."
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          💡 提示：单位支持多种格式，气温可填 °C/°F/K，载重可填 kg/lb/g，风速可填 m/s/km/h/mph，体积可填 m³/ft³/L
        </p>
      </div>
    </div>
  );
}
