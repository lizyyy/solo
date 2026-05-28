import React from 'react';
import { Settings, Link2, Shield } from 'lucide-react';
import { useHoistStore } from '../store/useHoistStore';

export function SettingsPanel() {
  const { cableSpec, params, updateCableSpec, updateParams } = useHoistStore();

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-slate-400" />
        <h3 className="text-lg font-semibold text-white">计算参数</h3>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-blue-400" />
            <h4 className="text-white font-medium">钢丝绳规格</h4>
          </div>
          <div className="grid grid-cols-3 gap-4 ml-6">
            <div>
              <label className="block text-sm text-slate-400 mb-1">直径 (mm)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={cableSpec.diameter}
                onChange={(e) =>
                  updateCableSpec({ diameter: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">破断载荷 (kN)</label>
              <input
                type="number"
                step="1"
                min="0"
                value={cableSpec.breakingLoad}
                onChange={(e) =>
                  updateCableSpec({ breakingLoad: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">材质</label>
              <input
                type="text"
                value={cableSpec.material}
                onChange={(e) => updateCableSpec({ material: e.target.value })}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-green-400" />
            <h4 className="text-white font-medium">安全设置</h4>
          </div>
          <div className="grid grid-cols-2 gap-4 ml-6">
            <div>
              <label className="block text-sm text-slate-400 mb-1">要求安全系数</label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={params.safetyFactor}
                onChange={(e) =>
                  updateParams({ safetyFactor: parseFloat(e.target.value) || 0 })
                }
                className={`w-full bg-slate-700 text-white px-3 py-2 rounded border focus:outline-none ${
                  params.safetyFactor < 3
                    ? 'border-red-500'
                    : params.safetyFactor < 5
                    ? 'border-yellow-500'
                    : 'border-slate-600 focus:border-blue-500'
                }`}
              />
              <p className="text-xs text-slate-500 mt-1">
                剧场吊装建议 ≥ 5，最低 ≥ 3
              </p>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">重力加速度 (m/s²)</label>
              <input
                type="number"
                step="0.1"
                value={params.gravity}
                onChange={(e) =>
                  updateParams({ gravity: parseFloat(e.target.value) || 9.8 })
                }
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">标准值: 9.8</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
