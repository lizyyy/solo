import { useEffect, useState } from 'react'
import { useAppStore } from '@/hooks/useAppStore'
import { api } from '@/utils/api'
import { Car, Plus, Trash2 } from 'lucide-react'

interface CarParam {
  id: string; car_name: string; mass_kg: number; motor_voltage_v: number;
  motor_rpm: number; motor_power_w: number; motor_efficiency_percent: number;
  panel_area_m2: number; panel_efficiency_percent: number; wheel_diameter_m: number;
}

const defaultForm = {
  car_name: '默认小车', mass_kg: 0.5, motor_voltage_v: 6, motor_rpm: 3000,
  motor_power_w: 2, motor_efficiency_percent: 60, panel_area_m2: 0.03,
  panel_efficiency_percent: 20, wheel_diameter_m: 0.06,
}

export default function CarParams() {
  const { currentProjectId, showToast } = useAppStore()
  const [params, setParams] = useState<CarParam[]>([])
  const [form, setForm] = useState({ ...defaultForm })

  useEffect(() => {
    if (currentProjectId) loadParams()
  }, [currentProjectId])

  async function loadParams() {
    try {
      const res = await api.carParams.list(currentProjectId!)
      setParams(res.data || [])
    } catch { showToast('加载小车参数失败', 'error') }
  }

  async function addParam() {
    try {
      await api.carParams.create({ project_id: currentProjectId, ...form })
      setForm({ ...defaultForm })
      await loadParams()
      showToast('小车参数已添加')
    } catch { showToast('添加失败', 'error') }
  }

  async function deleteParam(id: string) {
    try {
      await api.carParams.delete(id)
      await loadParams()
      showToast('已删除')
    } catch { showToast('删除失败', 'error') }
  }

  const panelPower = (form.panel_area_m2 * form.panel_efficiency_percent / 100 * 1000).toFixed(2)
  const motorOutput = (form.motor_power_w * form.motor_efficiency_percent / 100).toFixed(2)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">小车参数</h1>
        <p className="text-sm text-slate-400 mt-1">质量、电机和太阳能板参数配置</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">添加小车参数</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">小车名称</label>
              <input
                value={form.car_name}
                onChange={e => setForm({ ...form, car_name: e.target.value })}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">质量 (kg)</label>
                <input type="number" step="0.1" value={form.mass_kg} onChange={e => setForm({ ...form, mass_kg: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">轮径 (m)</label>
                <input type="number" step="0.01" value={form.wheel_diameter_m} onChange={e => setForm({ ...form, wheel_diameter_m: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
              </div>
            </div>

            <div className="border-t border-slate-700/30 pt-4">
              <p className="text-xs text-slate-400 mb-3 font-medium">电机参数</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">电压 (V)</label>
                  <input type="number" value={form.motor_voltage_v} onChange={e => setForm({ ...form, motor_voltage_v: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">转速 (rpm)</label>
                  <input type="number" value={form.motor_rpm} onChange={e => setForm({ ...form, motor_rpm: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">功率 (W)</label>
                  <input type="number" value={form.motor_power_w} onChange={e => setForm({ ...form, motor_power_w: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">效率 (%)</label>
                  <input type="number" value={form.motor_efficiency_percent} onChange={e => setForm({ ...form, motor_efficiency_percent: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-700/30 pt-4">
              <p className="text-xs text-slate-400 mb-3 font-medium">太阳能板参数</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">板面积 (m²)</label>
                  <input type="number" step="0.001" value={form.panel_area_m2} onChange={e => setForm({ ...form, panel_area_m2: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">板效率 (%)</label>
                  <input type="number" value={form.panel_efficiency_percent} onChange={e => setForm({ ...form, panel_efficiency_percent: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50" />
                </div>
              </div>
            </div>

            <button onClick={addParam} className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> 添加小车参数
            </button>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-3">实时计算预览</h2>
          <div className="space-y-3">
            <div className="p-3 bg-slate-900/30 rounded-lg">
              <p className="text-xs text-slate-400">太阳能板理论功率</p>
              <p className="text-lg font-bold mt-0.5">{panelPower} W</p>
              <p className="text-xs text-slate-500">= {form.panel_area_m2}m² × {form.panel_efficiency_percent}% × 1000W/m²</p>
            </div>
            <div className="p-3 bg-slate-900/30 rounded-lg">
              <p className="text-xs text-slate-400">电机输出功率</p>
              <p className="text-lg font-bold mt-0.5">{motorOutput} W</p>
              <p className="text-xs text-slate-500">= {form.motor_power_w}W × {form.motor_efficiency_percent}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50 text-slate-400 text-xs">
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">名称</th>
              <th className="text-left px-4 py-3">质量(kg)</th>
              <th className="text-left px-4 py-3">电机功率(W)</th>
              <th className="text-left px-4 py-3">电机效率(%)</th>
              <th className="text-left px-4 py-3">板面积(m²)</th>
              <th className="text-left px-4 py-3">板效率(%)</th>
              <th className="text-right px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {params.map(p => (
              <tr key={p.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.id.slice(0, 8)}…</td>
                <td className="px-4 py-3">{p.car_name}</td>
                <td className="px-4 py-3">{p.mass_kg}</td>
                <td className="px-4 py-3">{p.motor_power_w}</td>
                <td className="px-4 py-3">{p.motor_efficiency_percent}</td>
                <td className="px-4 py-3">{p.panel_area_m2}</td>
                <td className="px-4 py-3">{p.panel_efficiency_percent}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => deleteParam(p.id)} className="p-1.5 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {params.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  <Car className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  暂无小车参数
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
