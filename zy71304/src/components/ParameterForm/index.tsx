import { ChevronDown, Thermometer, Package, Box, Wind, User } from 'lucide-react';
import type { PrintBatch, Unit } from '../../types';
import { MATERIALS } from '../../data/materials';
import { usePrintStore } from '../../store/usePrintStore';

interface ParameterFormProps {
  batch: PrintBatch;
}

const UNITS: Unit[] = ['mm', 'cm', 'in'];
const UNIT_LABELS: Record<Unit, string> = {
  mm: 'mm',
  cm: 'cm',
  in: 'in',
};

export const ParameterForm = ({ batch }: ParameterFormProps) => {
  const { updateBatchParam, currentUser, setCurrentUser } = usePrintStore();

  const handleInputChange = (key: keyof PrintBatch, value: string | number) => {
    updateBatchParam(key, value as never);
  };

  const selectedMaterial = MATERIALS.find((m) => m.id === batch.materialId);

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-gray-300">操作人员</span>
        </div>
        <input
          type="text"
          value={currentUser}
          onChange={(e) => setCurrentUser(e.target.value)}
          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none transition-colors"
          placeholder="请输入您的姓名"
        />
      </div>

      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-gray-300">材料选择</span>
        </div>
        <div className="relative">
          <select
            value={batch.materialId}
            onChange={(e) => handleInputChange('materialId', e.target.value)}
            className="w-full appearance-none bg-slate-900 border border-slate-600 rounded px-3 py-2.5 text-white focus:border-blue-500 focus:outline-none cursor-pointer pr-10"
          >
            {MATERIALS.map((mat) => (
              <option key={mat.id} value={mat.id}>
                {mat.name} (α={mat.thermalExpansionCoeff}μm/m·°C)
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        {selectedMaterial && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="bg-slate-900 p-2 rounded text-center">
              <div className="text-gray-500">玻璃化温度</div>
              <div className="text-purple-300 font-mono">{selectedMaterial.glassTransitionTemp}°C</div>
            </div>
            <div className="bg-slate-900 p-2 rounded text-center">
              <div className="text-gray-500">推荐床温</div>
              <div className="text-orange-300 font-mono">{selectedMaterial.recommendedBedTemp}°C</div>
            </div>
            <div className="bg-slate-900 p-2 rounded text-center">
              <div className="text-gray-500">推荐喷嘴</div>
              <div className="text-red-300 font-mono">{selectedMaterial.recommendedNozzleTemp}°C</div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Thermometer className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium text-gray-300">温度参数</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              床温 (°C)
              {selectedMaterial && (
                <span className="text-orange-400 ml-1">
                  推荐 {selectedMaterial.recommendedBedTemp}
                </span>
              )}
            </label>
            <input
              type="number"
              value={batch.bedTemp}
              onChange={(e) => handleInputChange('bedTemp', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              喷嘴温度 (°C)
              {selectedMaterial && (
                <span className="text-red-400 ml-1">
                  推荐 {selectedMaterial.recommendedNozzleTemp}
                </span>
              )}
            </label>
            <input
              type="number"
              value={batch.nozzleTemp}
              onChange={(e) => handleInputChange('nozzleTemp', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">环境温度 (°C)</label>
            <input
              type="number"
              value={batch.ambientTemp}
              onChange={(e) => handleInputChange('ambientTemp', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Box className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-gray-300">模型尺寸</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">宽度</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={batch.modelWidth}
                onChange={(e) => handleInputChange('modelWidth', parseFloat(e.target.value) || 0)}
                className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
              />
              <select
                value={batch.widthUnit}
                onChange={(e) => handleInputChange('widthUnit', e.target.value)}
                className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">高度</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={batch.modelHeight}
                onChange={(e) => handleInputChange('modelHeight', parseFloat(e.target.value) || 0)}
                className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
              />
              <select
                value={batch.heightUnit}
                onChange={(e) => handleInputChange('heightUnit', e.target.value)}
                className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">深度</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={batch.modelDepth}
                onChange={(e) => handleInputChange('modelDepth', parseFloat(e.target.value) || 0)}
                className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
              />
              <select
                value={batch.depthUnit}
                onChange={(e) => handleInputChange('depthUnit', e.target.value)}
                className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Wind className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-gray-300">冷却与速度</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">冷却风扇 (%)</label>
            <input
              type="range"
              min="0"
              max="100"
              value={batch.coolingFanSpeed}
              onChange={(e) => handleInputChange('coolingFanSpeed', parseInt(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-center font-mono text-blue-300">{batch.coolingFanSpeed}%</div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">层高 (mm)</label>
            <input
              type="number"
              step="0.05"
              min="0.1"
              max="0.4"
              value={batch.layerHeight}
              onChange={(e) => handleInputChange('layerHeight', parseFloat(e.target.value) || 0.2)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">打印速度 (mm/s)</label>
            <input
              type="number"
              min="10"
              max="150"
              value={batch.printSpeed}
              onChange={(e) => handleInputChange('printSpeed', parseFloat(e.target.value) || 60)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
