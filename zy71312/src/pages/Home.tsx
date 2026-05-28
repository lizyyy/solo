import React, { useEffect, useState } from 'react';
import { Sun, RefreshCw, Settings, Info } from 'lucide-react';
import { SolarScene } from '@/components/Scene3D/SolarScene';
import { LocationPanel } from '@/components/Panel/LocationPanel';
import { RoofPanel } from '@/components/Panel/RoofPanel';
import { ShadingPanel } from '@/components/Panel/ShadingPanel';
import { ComponentPanel } from '@/components/Panel/ComponentPanel';
import { AngleResult } from '@/components/Result/AngleResult';
import { EnergyChart } from '@/components/Result/EnergyChart';
import { ProfitCard } from '@/components/Result/ProfitCard';
import { ScenarioCompare } from '@/components/Compare/ScenarioCompare';
import { ReportExport } from '@/components/Report/ReportExport';
import { useSolarStore } from '@/store/useSolarStore';

export default function Home() {
  const { calculateAll, resetToDefaults, warnings } = useSolarStore();
  const [activeTab, setActiveTab] = useState<'params' | 'scenario'>('params');
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    calculateAll();
  }, []);

  const warningCount = Object.values(warnings).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <Sun className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">太阳能板倾角试算</h1>
                <p className="text-xs text-gray-500">专业光伏收益分析工具</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {warningCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                  <Info className="w-3 h-3" />
                  {warningCount} 条提示
                </div>
              )}
              <button
                onClick={resetToDefaults}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重置
              </button>
              <button
                onClick={() => setShowAbout(!showAbout)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-100px)]">
          <div className="col-span-5 bg-white rounded-xl shadow-lg overflow-hidden">
            <SolarScene />
          </div>

          <div className="col-span-4 flex flex-col gap-4 overflow-hidden">
            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('params')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'params'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                参数设置
              </button>
              <button
                onClick={() => setActiveTab('scenario')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'scenario'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                情景对比
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {activeTab === 'params' ? (
                <>
                  <LocationPanel />
                  <RoofPanel />
                  <ShadingPanel />
                  <ComponentPanel />
                </>
              ) : (
                <>
                  <ScenarioCompare />
                  <ReportExport />
                </>
              )}
            </div>
          </div>

          <div className="col-span-3 flex flex-col gap-4 overflow-hidden">
            <AngleResult />
            <ProfitCard />
            <EnergyChart />

            {warningCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="text-sm font-medium text-amber-800 mb-2">
                  ⚠️ 数据提示
                </div>
                <div className="space-y-1">
                  {warnings.latitudeWarning && (
                    <div className="text-xs text-amber-700">
                      • {warnings.latitudeWarning}
                    </div>
                  )}
                  {warnings.shadingWarning && (
                    <div className="text-xs text-amber-700">
                      • {warnings.shadingWarning}
                    </div>
                  )}
                  {warnings.seasonWeightsWarning && (
                    <div className="text-xs text-amber-700">
                      • {warnings.seasonWeightsWarning}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {showAbout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-3">关于本工具</h3>
            <div className="text-sm text-gray-600 space-y-2">
              <p>这是一个专业的太阳能板倾角优化工具，用于帮助光伏销售工程师快速估算不同条件下的收益。</p>
              <p className="font-medium text-gray-700">核心功能：</p>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li>基于纬度的太阳高度角精确计算</li>
                <li>多种倾角优化策略（全年/冬季/夏季/自定义）</li>
                <li>分时段遮挡损失分析</li>
                <li>季节权重自定义配置</li>
                <li>多方案情景对比</li>
                <li>专业PDF报告导出</li>
              </ul>
              <p className="text-xs text-gray-400 mt-4">
                提示：本工具计算结果仅供参考，实际发电量受天气、电网等多种因素影响。
              </p>
            </div>
            <button
              onClick={() => setShowAbout(false)}
              className="mt-4 w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
