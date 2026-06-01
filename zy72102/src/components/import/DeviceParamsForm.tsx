import React from 'react';
import { Settings } from 'lucide-react';
import type { DeviceParams } from '../../types';

interface DeviceParamsFormProps {
  params: DeviceParams;
  onChange: (params: Partial<DeviceParams>) => void;
}

export function DeviceParamsForm({ params, onChange }: DeviceParamsFormProps) {
  return (
    <div className="rounded-lg bg-slate-800/50 p-6">
      <div className="mb-4 flex items-center space-x-2">
        <Settings className="h-5 w-5 text-cyan-400" />
        <h3 className="text-lg font-medium text-white">设备参数配置</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300">设备名称</label>
          <input
            type="text"
            value={params.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            质量 (kg)
          </label>
          <input
            type="number"
            value={params.mass}
            onChange={(e) => onChange({ mass: parseFloat(e.target.value) || 0 })}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            坡道角度 (°)
          </label>
          <input
            type="number"
            value={params.slopeAngle}
            onChange={(e) =>
              onChange({ slopeAngle: parseFloat(e.target.value) || 0 })
            }
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            摩擦系数
          </label>
          <input
            type="number"
            step="0.01"
            value={params.frictionCoeff}
            onChange={(e) =>
              onChange({ frictionCoeff: parseFloat(e.target.value) || 0 })
            }
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            重力加速度 (m/s²)
          </label>
          <input
            type="number"
            step="0.01"
            value={params.gravity}
            onChange={(e) => onChange({ gravity: parseFloat(e.target.value) || 0 })}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            振动阈值 (mm/s)
          </label>
          <input
            type="number"
            step="0.1"
            value={params.vibrationThreshold}
            onChange={(e) =>
              onChange({ vibrationThreshold: parseFloat(e.target.value) || 0 })
            }
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            正常温度范围 (°C)
          </label>
          <div className="mt-1 flex space-x-2">
            <input
              type="number"
              value={params.normalTempMin}
              onChange={(e) =>
                onChange({ normalTempMin: parseFloat(e.target.value) || 0 })
              }
              placeholder="下限"
              className="w-1/2 rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <input
              type="number"
              value={params.normalTempMax}
              onChange={(e) =>
                onChange({ normalTempMax: parseFloat(e.target.value) || 0 })
              }
              placeholder="上限"
              className="w-1/2 rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
