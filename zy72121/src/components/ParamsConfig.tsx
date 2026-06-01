import { useState } from 'react';
import { Settings, Plus, Check, History } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../utils/cn';

export default function ParamsConfig() {
  const {
    params,
    setParams,
    thresholds,
    activeThresholdId,
    setActiveThreshold,
    addThreshold,
  } = useAppStore();

  const [showNewThreshold, setShowNewThreshold] = useState(false);
  const [newThreshold, setNewThreshold] = useState({
    version: '',
    warningThreshold: 100,
    dangerThreshold: 180,
    unit: 'W',
    description: '',
  });

  const activeThreshold = thresholds.find(t => t.id === activeThresholdId);

  const handleAddThreshold = () => {
    if (!newThreshold.version) return;
    addThreshold(newThreshold);
    setShowNewThreshold(false);
    setNewThreshold({
      version: '',
      warningThreshold: 100,
      dangerThreshold: 180,
      unit: 'W',
      description: '',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          核算参数
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg">
          <label className="block text-sm font-medium text-slate-600 mb-1">
            综合传热系数 k (W/(m²·°C))
          </label>
          <input
            type="number"
            step="0.1"
            value={params.heatTransferCoeff}
            onChange={(e) => setParams({ ...params, heatTransferCoeff: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-slate-500">门帘综合传热系数，默认3.5</p>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg">
          <label className="block text-sm font-medium text-slate-600 mb-1">
            开门时间系数 f
          </label>
          <input
            type="number"
            step="0.01"
            value={params.openingTimeFactor}
            onChange={(e) => setParams({ ...params, openingTimeFactor: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-slate-500">考虑开门频次的修正系数，0~1之间</p>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg">
          <label className="block text-sm font-medium text-slate-600 mb-1">
            空气密度 ρ (kg/m³)
          </label>
          <input
            type="number"
            step="0.01"
            value={params.airDensity}
            onChange={(e) => setParams({ ...params, airDensity: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-slate-500">常温下空气密度约1.2 kg/m³</p>
        </div>

        <div className="p-4 bg-slate-50 rounded-lg">
          <label className="block text-sm font-medium text-slate-600 mb-1">
            定压比热容 Cp (kJ/(kg·°C))
          </label>
          <input
            type="number"
            step="0.001"
            value={params.specificHeatCapacity}
            onChange={(e) => setParams({ ...params, specificHeatCapacity: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-slate-500">空气定压比热容约1.005</p>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <History className="w-4 h-4" />
            阈值版本
          </h3>
          <button
            onClick={() => setShowNewThreshold(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建版本
          </button>
        </div>

        <div className="space-y-2">
          {thresholds.map((threshold) => (
            <div
              key={threshold.id}
              onClick={() => setActiveThreshold(threshold.id)}
              className={cn(
                'p-3 border rounded-lg cursor-pointer transition-all',
                threshold.id === activeThresholdId
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {threshold.id === activeThresholdId && (
                    <Check className="w-4 h-4 text-blue-600" />
                  )}
                  <span className="font-medium text-slate-800">{threshold.version}</span>
                  {threshold.id === activeThresholdId && (
                    <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">当前</span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {threshold.createdAt} · {threshold.createdBy}
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-sm">
                <span className="text-amber-600">预警: {threshold.warningThreshold}{threshold.unit}</span>
                <span className="text-red-600">危险: {threshold.dangerThreshold}{threshold.unit}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{threshold.description}</p>
            </div>
          ))}
        </div>

        {showNewThreshold && (
          <div className="mt-4 p-4 border border-blue-200 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-slate-800 mb-3">新建阈值版本</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">版本号</label>
                <input
                  type="text"
                  value={newThreshold.version}
                  onChange={(e) => setNewThreshold({ ...newThreshold, version: e.target.value })}
                  placeholder="例如: v3.0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">单位</label>
                <select
                  value={newThreshold.unit}
                  onChange={(e) => setNewThreshold({ ...newThreshold, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="W">W</option>
                  <option value="kW">kW</option>
                  <option value="kWh/d">kWh/d</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-amber-600 mb-1">预警阈值</label>
                <input
                  type="number"
                  value={newThreshold.warningThreshold}
                  onChange={(e) => setNewThreshold({ ...newThreshold, warningThreshold: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-red-600 mb-1">危险阈值</label>
                <input
                  type="number"
                  value={newThreshold.dangerThreshold}
                  onChange={(e) => setNewThreshold({ ...newThreshold, dangerThreshold: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-600 mb-1">版本说明</label>
                <input
                  type="text"
                  value={newThreshold.description}
                  onChange={(e) => setNewThreshold({ ...newThreshold, description: e.target.value })}
                  placeholder="描述此版本阈值的调整原因..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowNewThreshold(false)}
                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddThreshold}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
