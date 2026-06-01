import { Settings, Info, RotateCcw, Database } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { DEFAULT_CALC_PARAMS } from '../data/mockData';

export default function SettingsPage() {
  const { params, setParams, resetToDemo, clearAll } = useAppStore();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-slate-700" />
        <h1 className="text-xl font-bold text-slate-800">系统设置</h1>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="p-4 bg-white border border-slate-200 rounded-xl">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5" />
              默认参数配置
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">综合传热系数 k (W/(m²·°C))</label>
                <input
                  type="number"
                  step="0.1"
                  value={params.heatTransferCoeff}
                  onChange={(e) => setParams({ ...params, heatTransferCoeff: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">开门时间系数 f</label>
                <input
                  type="number"
                  step="0.01"
                  value={params.openingTimeFactor}
                  onChange={(e) => setParams({ ...params, openingTimeFactor: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">空气密度 ρ (kg/m³)</label>
                <input
                  type="number"
                  step="0.01"
                  value={params.airDensity}
                  onChange={(e) => setParams({ ...params, airDensity: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">定压比热容 Cp (kJ/(kg·°C))</label>
                <input
                  type="number"
                  step="0.001"
                  value={params.specificHeatCapacity}
                  onChange={(e) => setParams({ ...params, specificHeatCapacity: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              关于公式
            </h4>
            <p className="text-sm text-amber-700">
              热损失计算公式：Q = k × A × ΔT × f
            </p>
            <p className="text-xs text-amber-600 mt-1">
              其中：k为传热系数，A为门帘面积，ΔT为温差，f为开门时间系数
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h4 className="font-medium text-slate-800 mb-3">数据管理</h4>
            <div className="space-y-2">
              <button
                onClick={() => setParams(DEFAULT_CALC_PARAMS)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                恢复默认参数
              </button>
              <button
                onClick={resetToDemo}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                重置演示数据
              </button>
              <button
                onClick={clearAll}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                清空所有数据
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-white border border-slate-200 rounded-xl">
            <h3 className="font-semibold text-slate-800 mb-4">使用说明</h3>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-medium text-blue-800">1. 数据导入</p>
                <p className="text-blue-700">支持上传CSV/TSV文件或直接粘贴数据，系统会自动识别单位并检测数据质量。</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="font-medium text-green-800">2. 参数配置</p>
                <p className="text-green-700">可根据实际情况调整传热系数、开门系数等参数，支持多版本阈值管理。</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg">
                <p className="font-medium text-amber-800">3. 执行核算</p>
                <p className="text-amber-700">点击执行计算后生成批次，支持添加备注说明，生成业务友好的处理建议。</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="font-medium text-purple-800">4. 历史对比</p>
                <p className="text-purple-700">可对比不同批次的计算结果，查看参数差异和判定变化。</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-lg">
                <p className="font-medium text-rose-800">5. 报告导出</p>
                <p className="text-rose-700">支持导出PDF报告或复制文本，包含完整的核算结果和处理建议。</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h4 className="font-medium text-slate-800 mb-2">版本信息</h4>
            <div className="text-sm text-slate-600">
              <p>版本：v1.0.0</p>
              <p>开发者：设备部</p>
              <p>适用场景：冷库门帘热损失核算</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
