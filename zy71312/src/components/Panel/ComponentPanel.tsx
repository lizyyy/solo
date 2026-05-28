import React from 'react';
import { Zap, DollarSign } from 'lucide-react';
import { useSolarStore } from '../../store/useSolarStore';
import componentsData from '../../data/components.json';

export const ComponentPanel: React.FC = () => {
  const { params, setPanelParams, setElectricityPrice } = useSolarStore();

  const handleComponentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    const component = componentsData.find((c) => c.model === model);
    if (component) {
      setPanelParams({
        panelPower: component.power,
        panelEfficiency: component.efficiency,
        panelPrice: component.price,
      });
    }
  };

  const selectedComponent = componentsData.find(
    (c) => c.power === params.panelPower && c.efficiency === params.panelEfficiency
  );

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-800">组件与经济参数</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            光伏组件型号
          </label>
          <select
            value={selectedComponent?.model || ''}
            onChange={handleComponentChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
          >
            <option value="">选择组件型号</option>
            {componentsData.map((comp) => (
              <option key={comp.model} value={comp.model}>
                {comp.brand} {comp.model} ({comp.power}W)
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              组件功率: {params.panelPower}W
            </label>
            <input
              type="range"
              min="300"
              max="700"
              step="10"
              value={params.panelPower}
              onChange={(e) => setPanelParams({ panelPower: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              组件数量: {params.panelCount}块
            </label>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={params.panelCount}
              onChange={(e) => setPanelParams({ panelCount: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              转换效率: {params.panelEfficiency}%
            </label>
            <input
              type="number"
              min="15"
              max="25"
              step="0.1"
              value={params.panelEfficiency}
              onChange={(e) =>
                setPanelParams({ panelEfficiency: parseFloat(e.target.value) || 20 })
              }
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              组件单价: ¥{params.panelPrice}/W
            </label>
            <input
              type="number"
              min="1"
              max="5"
              step="0.1"
              value={params.panelPrice}
              onChange={(e) =>
                setPanelParams({ panelPrice: parseFloat(e.target.value) || 1.5 })
              }
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="font-medium text-gray-700 text-sm">经济参数</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              电价: ¥{params.electricityPrice}/kWh
            </label>
            <input
              type="range"
              min="0.3"
              max="1.5"
              step="0.05"
              value={params.electricityPrice}
              onChange={(e) => setElectricityPrice(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.3元</span>
              <span>居民用电 0.6元</span>
              <span>1.5元</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-xs text-blue-700">
            <div className="font-medium mb-2">系统概览</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-blue-500">系统容量</span>
                <div className="font-bold text-base">
                  {((params.panelPower * params.panelCount) / 1000).toFixed(1)} kW
                </div>
              </div>
              <div>
                <span className="text-blue-500">预计投资</span>
                <div className="font-bold text-base">
                  ¥{((params.panelPower * params.panelCount * params.panelPrice * 1.7) / 10000).toFixed(1)}万
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
