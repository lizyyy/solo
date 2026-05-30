import { Clock, Beaker, Pill, Timer, Settings } from 'lucide-react';
import { useSimulationStore } from '../store/simulationStore';
import { ConcentrationUnit } from '../types/simulation';

const units: ConcentrationUnit[] = ['mg/L', 'μg/mL', 'ng/mL'];

export const ParameterPanel = () => {
  const { config, setDrugConfig, setDosingConfig, setConfig } = useSimulationStore();
  const { drug, dosing, simulationDuration, timeStep } = config;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
        <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
          <Settings className="w-5 h-5 text-teal-700" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">参数配置</h2>
          <p className="text-sm text-gray-500">设置药物和给药方案参数</p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Beaker className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-semibold text-gray-700">药物参数</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">药物名称</label>
              <input
                type="text"
                value={drug.name}
                onChange={(e) => setDrugConfig({ name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                <Clock className="w-3 h-3 inline mr-1" />
                半衰期 (h)
              </label>
              <input
                type="number"
                value={drug.halfLife}
                onChange={(e) => setDrugConfig({ halfLife: Number(e.target.value) })}
                min="0.1"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">分布容积 (L)</label>
              <input
                type="number"
                value={drug.volumeOfDistribution}
                onChange={(e) => setDrugConfig({ volumeOfDistribution: Number(e.target.value) })}
                min="0.1"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">浓度单位</label>
              <select
                value={drug.unit}
                onChange={(e) => setDrugConfig({ unit: e.target.value as ConcentrationUnit })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              >
                {units.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">最低有效浓度</label>
              <input
                type="number"
                value={drug.therapeuticMin}
                onChange={(e) => setDrugConfig({ therapeuticMin: Number(e.target.value) })}
                min="0"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">最高安全浓度</label>
              <input
                type="number"
                value={drug.therapeuticMax}
                onChange={(e) => setDrugConfig({ therapeuticMax: Number(e.target.value) })}
                min="0"
                step="0.1"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5 space-y-3">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-gray-700">给药方案</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">单次剂量 (mg)</label>
              <input
                type="number"
                value={dosing.dose}
                onChange={(e) => setDosingConfig({ dose: Number(e.target.value) })}
                min="0"
                step="10"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                <Timer className="w-3 h-3 inline mr-1" />
                给药间隔 (h)
              </label>
              <input
                type="number"
                value={dosing.interval}
                onChange={(e) => setDosingConfig({ interval: Number(e.target.value) })}
                min="0"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">给药次数</label>
              <input
                type="number"
                value={dosing.dosesCount}
                onChange={(e) => setDosingConfig({ dosesCount: Number(e.target.value) })}
                min="1"
                step="1"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">首次给药时间 (h)</label>
              <input
                type="number"
                value={dosing.startTime}
                onChange={(e) => setDosingConfig({ startTime: Number(e.target.value) })}
                min="0"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">模拟设置</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">模拟时长 (h)</label>
              <input
                type="number"
                value={simulationDuration}
                onChange={(e) => setConfig({ simulationDuration: Number(e.target.value) })}
                min="1"
                step="1"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">时间步长 (h)</label>
              <input
                type="number"
                value={timeStep}
                onChange={(e) => setConfig({ timeStep: Number(e.target.value) })}
                min="0.01"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
