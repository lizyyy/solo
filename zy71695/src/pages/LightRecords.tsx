import { useEffect, useState } from 'react'
import { useAppStore } from '@/hooks/useAppStore'
import { api } from '@/utils/api'
import { Sun, Plus, Trash2, AlertTriangle } from 'lucide-react'

const LIGHT_THRESHOLD = 200

interface LightRecord { id: string; time_slot: string; intensity_wm2: number; source: string }

export default function LightRecords() {
  const { currentProjectId, showToast } = useAppStore()
  const [records, setRecords] = useState<LightRecord[]>([])
  const [timeSlot, setTimeSlot] = useState('')
  const [intensity, setIntensity] = useState('')

  useEffect(() => {
    if (currentProjectId) loadRecords()
  }, [currentProjectId])

  async function loadRecords() {
    try {
      const res = await api.lightRecords.list(currentProjectId!)
      setRecords(res.data || [])
    } catch { showToast('加载光照记录失败', 'error') }
  }

  async function addRecord() {
    if (!timeSlot || !intensity) return
    try {
      await api.lightRecords.create({ project_id: currentProjectId, time_slot: timeSlot, intensity_wm2: parseFloat(intensity) })
      setTimeSlot('')
      setIntensity('')
      await loadRecords()
      showToast('光照记录已添加')
    } catch { showToast('添加失败', 'error') }
  }

  async function deleteRecord(id: string) {
    try {
      await api.lightRecords.delete(id)
      await loadRecords()
      showToast('已删除')
    } catch { showToast('删除失败', 'error') }
  }

  const avgIntensity = records.length > 0 ? records.reduce((s, r) => s + r.intensity_wm2, 0) / records.length : 0
  const lowCount = records.filter(r => r.intensity_wm2 < LIGHT_THRESHOLD).length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">光照记录</h1>
        <p className="text-sm text-slate-400 mt-1">按时间段录入光照强度，自动检测缺口</p>
      </div>

      {lowCount > 0 && (
        <div className="bg-red-500/10 border-l-4 border-red-500/50 rounded-r-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-300">{lowCount}条记录低于{LIGHT_THRESHOLD} W/m²阈值</p>
              <p className="text-xs text-slate-300 mt-1">💰 光照不足可能导致功率不够，完赛时间大幅增加，影响参赛名单和预算</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">记录总数</p>
          <p className="text-xl font-bold mt-1">{records.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">平均光照</p>
          <p className="text-xl font-bold mt-1">{avgIntensity.toFixed(1)} W/m²</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">缺口记录</p>
          <p className="text-xl font-bold mt-1 text-red-400">{lowCount}</p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-3">添加记录</h2>
        <div className="flex gap-2">
          <input
            value={timeSlot}
            onChange={e => setTimeSlot(e.target.value)}
            placeholder="时间段 (如 08:00-09:00)"
            className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
          />
          <input
            type="number"
            value={intensity}
            onChange={e => setIntensity(e.target.value)}
            placeholder="光照强度 (W/m²)"
            className="w-40 bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50"
          />
          <button onClick={addRecord} className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> 添加
          </button>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50 text-slate-400 text-xs">
              <th className="text-left px-4 py-3">ID</th>
              <th className="text-left px-4 py-3">时间段</th>
              <th className="text-left px-4 py-3">光照强度 (W/m²)</th>
              <th className="text-left px-4 py-3">来源</th>
              <th className="text-left px-4 py-3">状态</th>
              <th className="text-right px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => {
              const isLow = r.intensity_wm2 < LIGHT_THRESHOLD
              return (
                <tr key={r.id} className={`border-b border-slate-700/30 ${isLow ? 'bg-red-500/10' : 'hover:bg-slate-700/20'}`}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3">{r.time_slot}</td>
                  <td className="px-4 py-3">
                    <span className={isLow ? 'text-red-400 font-medium' : ''}>{r.intensity_wm2}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{r.source}</td>
                  <td className="px-4 py-3">
                    {isLow ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">缺口</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">正常</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteRecord(r.id)} className="p-1.5 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
            {records.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  <Sun className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  暂无光照记录，请先添加
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
