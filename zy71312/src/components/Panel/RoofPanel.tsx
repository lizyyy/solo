import React from 'react';
import { Home, Sun, Calendar } from 'lucide-react';
import { useSolarStore } from '../../store/useSolarStore';
import type { OptimizationStrategy } from '../../types';

export const RoofPanel: React.FC = () => {
  const {
    params,
    optimizationStrategy,
    useCustomAngle,
    setRoofAngle,
    setRoofAzimuth,
    setOptimizationStrategy,
    setUseCustomAngle,
    setCustomAngle,
  } = useSolarStore();

  const strategies: { value: OptimizationStrategy; label: string; desc: string }[] = [
    { value: 'yearly', label: '全年优化', desc: '平衡各季节发电量' },
    { value: 'winter', label: '冬季优先', desc: '最大化冬季低角度阳光' },
    { value: 'summer', label: '夏季优先', desc: '适应夏季高角度阳光' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <Home className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-800">屋顶与倾角</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            屋顶坡度: {params.roofAngle}°
          </label>
          <input
            type="range"
            min="0"
            max="60"
            step="1"
            value={params.roofAngle}
            onChange={(e) => setRoofAngle(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>平屋顶 0°</span>
            <span>陡坡 60°</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            屋顶朝向: {params.roofAzimuth}° ({params.roofAzimuth === 180 ? '正南' : params.roofAzimuth < 180 ? '偏东' : '偏西'})
          </label>
          <input
            type="range"
            min="90"
            max="270"
            step="5"
            value={params.roofAzimuth}
            onChange={(e) => setRoofAzimuth(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>正东 90°</span>
            <span>正南 180°</span>
            <span>正西 270°</span>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Sun className="w-4 h-4 text-amber-500" />
            <span className="font-medium text-gray-700">倾角优化策略</span>
          </div>
          <div className="space-y-2">
            {strategies.map((s) => (
              <label
                key={s.value}
                className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${
                  optimizationStrategy === s.value && !useCustomAngle
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="strategy"
                  value={s.value}
                  checked={optimizationStrategy === s.value && !useCustomAngle}
                  onChange={() => {
                    setUseCustomAngle(false);
                    setOptimizationStrategy(s.value);
                  }}
                  className="mt-1 mr-3"
                />
                <div>
                  <div className="font-medium text-gray-800">{s.label}</div>
                  <div className="text-xs text-gray-500">{s.desc}</div>
                </div>
              </label>
            ))}

            <label
              className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all ${
                useCustomAngle
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="strategy"
                checked={useCustomAngle}
                onChange={() => setUseCustomAngle(true)}
                className="mt-1 mr-3"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-800">自定义倾角</div>
                {useCustomAngle && (
                  <input
                    type="number"
                    min="0"
                    max="90"
                    step="0.5"
                    value={params.customAngle ?? params.roofAngle}
                    onChange={(e) => setCustomAngle(parseFloat(e.target.value) || 0)}
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            </label>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-green-500" />
            <span className="font-medium text-gray-700">季节权重</span>
          </div>
          <SeasonWeights />
        </div>
      </div>
    </div>
  );
};

function SeasonWeights() {
  const { params, setSeasonWeights, warnings } = useSolarStore();

  const seasons = [
    { key: 'spring', label: '春', color: 'bg-green-500' },
    { key: 'summer', label: '夏', color: 'bg-red-500' },
    { key: 'autumn', label: '秋', color: 'bg-yellow-500' },
    { key: 'winter', label: '冬', color: 'bg-blue-500' },
  ] as const;

  return (
    <div>
      {warnings.seasonWeightsWarning && (
        <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
          ⚠️ {warnings.seasonWeightsWarning}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {seasons.map(({ key, label, color }) => (
          <div key={key}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-sm text-gray-600">{label}</span>
            </div>
            <input
              type="number"
              min="0"
              max="5"
              step="0.5"
              value={params.seasonWeights[key]}
              onChange={(e) =>
                setSeasonWeights({ [key]: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        权重越高，该季节发电量在优化中的占比越大
      </p>
    </div>
  );
}
