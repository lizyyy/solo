import { useEffect, useState } from 'react'
import { useAppStore } from '@/hooks/useAppStore'
import { api } from '@/utils/api'
import { Mountain, Plus, Trash2, AlertTriangle } from 'lucide-react'

const GEAR_MIN = 0.5
const GEAR_MAX = 10

interface TrackParam {
  id: string; slope_percent: number; slope_direction: string;
  gear_ratio: number; track_length_m: number; surface_type: string;
}

export default function TrackParams() {
  const { currentProjectId, showToast } = useAppStore()
  const [params, setParams] = useState<TrackParam[]>([])
  const [form, setForm] = useState({ slope_percent: 0, slope_direction: 'flat', gear_ratio: 3, track_length_m: 10, surface_type: 'smooth' })

  useEffect(() => {
    if (currentProjectId) loadParams()
  }, [currentProjectId])

  async function loadParams() {
    try {
      const res = await api.trackParams.list(currentProjectId!)
      setParams(res.data || [])
    } catch { showToast('加载赛道参数失败', 'error') }
  }

  async function addParam() {
    try {
      await api.trackParams.create({ project_id: currentProjectId, ...form })
      setForm({ slope_percent: 0, slope_direction: 'flat', gear_ratio: 3, track_length_m: 10, surface_type: 'smooth' })
      await loadParams()
      showToast('赛道参数已添加')
    } catch { showToast('添加失败', 'error') }
  }

  async function deleteParam(id: string) {
    try {
      await api.trackParams.delete(id)
      await loadParams()
      showToast('已删除')
    } catch { showToast('删除失败', 'error') }
  }

  const slopeDirWarning = form.slope_percent > 10 && form.slope_direction === 'uphill'
  const gearWarning = form.gear_ratio > GEAR_MAX || form.gear_ratio < GEAR_MIN

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">赛道参数</h1>
        <p className="text-sm text-slate-400 mt-1">坡度与齿轮比配置，自动检测异常</p>
      </div>

      {(slopeDirWarning || gearWarning) && (
        <div className="space-y-3">
          {slopeDirWarning && (
            <div className="bg-orange-500/10 border-l-4 border-orange-500/50 rounded-r-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-orange-300">上坡坡度{form.slope_percent}%过大</p>
                  <p className="text-xs text-slate-300 mt-1">💰 大坡度上坡将显著增加完赛时间，可能需要更换赛道方案或增加动力配置，影响预算和时间安排</p>
                </div>
              </div>
            </div>
          )}
          {gearWarning && (
            <div className="bg-yellow-500/10 border-l-4 border-yellow-500/50 rounded-r-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-300">齿轮比{form.gear_ratio}超出正常范围({GEAR_MIN}-{GEAR_MAX})</p>
                  <p className="text-xs text-slate-300 mt-1">💰 齿轮比越界可能导致扭矩不足或转速过高，影响完赛时间和零件采购预算</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-4">添加赛道参数</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">坡度 (%)</label>
            <input
              type="number"
              value={form.slope_percent}
              onChange={e => setForm({ ...form, slope_percent: parseFloat(e.target.value) || 0 })}
              className={`w-full bg-slate-900/50 border rounded-lg px-3 py-2 text-sm focus:outline-none ${slopeDirWarning ? 'border-orange-500/50' : 'border-slate-700/50 focus:border-amber-500/50'}`}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">坡度方向</label>
            <select
              value={form.slope_direction}
              onChange={e => setForm({ ...form, slope_direction: e.target.value })}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
            >
              <option value="flat">平路</option>
              <option value="uphill">上坡</option>
              <option value="downhill">下坡</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">齿轮比</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.1"
                value={form.gear_ratio}
                onChange={e => setForm({ ...form, gear_ratio: parseFloat(e.target.value) || 1 })}
                className={`w-24 bg-slate-900/50 border rounded-lg px-3 py-2 text-sm focus:outline-none ${gearWarning ? 'border-red-500/50 text-red-400' : 'border-slate-700/50 focus:border-amber-500/50'}`}
              />
              <input
                type="range"
                min="0.5"
                max="12"
                step="0.1"
                value={form.gear_ratio}
                onChange={e => setForm({ ...form, gear_ratio: parseFloat(e.target.value) })}
                className="flex-1 accent-amber-500"
              />
              <span className="text-xs text-slate-400 w-16 text-right">{form.gear_ratio}</span>
            </div>
            {gearWarning && <p className="text-xs text-red-400 mt-1">⚠ 超出正常范围 {GEAR_MIN}-{GEAR_MAX}</p>}
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">赛道长度 (m)</label>
            <input
              type="number"
              value={form.track_length_m}
              onChange={e => setForm({ ...form, track_length_m: parseFloat(e.target.value) || 10 })}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">路面类型</label>
            <select
              value={form.surface_type}
              onChange={e => setForm({ ...form, surface_type: e.target.value })}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
            >
              <option value="smooth">光滑</option>
              <option value="rough">粗糙</option>
              <option value="carpet">地毯</option>
            </select>
          </div>
        </div>
        <button onClick={addParam} className="mt-4 px-4 py-2 bg-amber-500 text-slate-900 rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> 添加赛道参数
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50 text-slate-400 text-xs">
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">坡度(%)</th>
              <th className="text-left px-4 py-3">方向</th>
              <th className="text-left px-4 py-3">齿轮比</th>
              <th className="text-left px-4 py-3">赛道长度(m)</th>
              <th className="text-left px-4 py-3">路面</th>
              <th className="text-right px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {params.map(p => {
              const gearOut = p.gear_ratio > GEAR_MAX || p.gear_ratio < GEAR_MIN
              const slopeOut = p.slope_percent > 10 && p.slope_direction === 'uphill'
              return (
                <tr key={p.id} className={`border-b border-slate-700/30 ${(gearOut || slopeOut) ? 'bg-orange-500/10' : 'hover:bg-slate-700/20'}`}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3">
                    <span className={slopeOut ? 'text-orange-400 font-medium' : ''}>{p.slope_percent}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={slopeOut ? 'text-orange-400' : ''}>
                      {p.slope_direction === 'uphill' ? '上坡' : p.slope_direction === 'downhill' ? '下坡' : '平路'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={gearOut ? 'text-red-400 font-medium' : ''}>{p.gear_ratio}</span>
                    {gearOut && <span className="ml-1 text-xs text-red-400">越界</span>}
                  </td>
                  <td className="px-4 py-3">{p.track_length_m}</td>
                  <td className="px-4 py-3">{p.surface_type === 'smooth' ? '光滑' : p.surface_type === 'rough' ? '粗糙' : '地毯'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteParam(p.id)} className="p-1.5 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
            {params.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  <Mountain className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  暂无赛道参数
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
