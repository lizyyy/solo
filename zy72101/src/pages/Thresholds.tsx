import { useState } from 'react'
import { Plus, GitCompare, Check, Clock, User } from 'lucide-react'
import { useStore } from '@/store'
import { getBandLabel, convertBandToDb } from '@/utils/engine'
import type { ThresholdBand } from '@/types'

function ThresholdEditor() {
  const addThreshold = useStore(s => s.addThreshold)
  const getCurrentThreshold = useStore(s => s.getCurrentThreshold)
  const thresholds = useStore(s => s.thresholds)

  const current = getCurrentThreshold()
  const [bands, setBands] = useState<ThresholdBand[]>(current.bands.map(b => ({ ...b })))
  const [reason, setReason] = useState('')
  const [modifiedBy, setModifiedBy] = useState('老唐')

  const nextVersion = thresholds.length > 0 ? Math.max(...thresholds.map(t => t.version)) + 1 : 1

  const handleSave = () => {
    if (!reason.trim()) return
    addThreshold(reason.trim(), modifiedBy.trim() || '匿名', bands)
    setReason('')
  }

  const updateBand = (idx: number, field: keyof ThresholdBand, value: number | string) => {
    const updated = bands.map((b, i) => {
      if (i !== idx) return b
      if (field === 'safeMax' || field === 'warnMax' || field === 'dangerMax') {
        return { ...b, [field]: value }
      }
      return b
    })
    setBands(updated)
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-gray-200">编辑阈值</h2>
        </div>
        <span className="text-xs text-amber-400/80 font-mono-data">保存后将生成 v{nextVersion}</span>
      </div>
      <div className="card-body space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800/40">
                <th className="text-left py-2 px-2">频段</th>
                <th className="text-right py-2 px-2">安全阈值 (Pa)</th>
                <th className="text-right py-2 px-2">警告阈值 (Pa)</th>
                <th className="text-right py-2 px-2">危险阈值 (Pa)</th>
                <th className="text-right py-2 px-2">安全 (dB)</th>
                <th className="text-right py-2 px-2">警告 (dB)</th>
                <th className="text-right py-2 px-2">危险 (dB)</th>
              </tr>
            </thead>
            <tbody>
              {bands.map((b, i) => {
                const dbBands = convertBandToDb(b)
                return (
                  <tr key={i} className="border-b border-gray-800/20">
                    <td className="py-1.5 px-2 font-mono-data text-gray-300">{getBandLabel(b)}</td>
                    <td className="py-1.5 px-2">
                      <input type="number" step="0.05" className="input-field w-20 text-right font-mono-data text-xs" value={b.safeMax} onChange={e => updateBand(i, 'safeMax', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" step="0.05" className="input-field w-20 text-right font-mono-data text-xs" value={b.warnMax} onChange={e => updateBand(i, 'warnMax', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="number" step="0.05" className="input-field w-20 text-right font-mono-data text-xs" value={b.dangerMax} onChange={e => updateBand(i, 'dangerMax', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono-data text-gray-500">{dbBands.safeMax.toFixed(1)}</td>
                    <td className="py-1.5 px-2 text-right font-mono-data text-gray-500">{dbBands.warnMax.toFixed(1)}</td>
                    <td className="py-1.5 px-2 text-right font-mono-data text-gray-500">{dbBands.dangerMax.toFixed(1)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-end gap-4 pt-2 border-t border-gray-800/40">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">修改原因</label>
            <input className="input-field w-full text-xs" placeholder="为什么调整阈值？" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <div className="w-28">
            <label className="text-xs text-gray-500 mb-1 block">操作人</label>
            <input className="input-field w-full text-xs" value={modifiedBy} onChange={e => setModifiedBy(e.target.value)} />
          </div>
          <button onClick={handleSave} disabled={!reason.trim()} className="btn-primary text-xs flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> 保存新版本
          </button>
        </div>
      </div>
    </div>
  )
}

function VersionTimeline() {
  const thresholds = useStore(s => s.thresholds)
  const currentThresholdVersion = useStore(s => s.currentThresholdVersion)

  if (thresholds.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center text-gray-500 text-sm py-8">暂无阈值版本记录</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-gray-200">版本历史</h2>
        </div>
      </div>
      <div className="card-body">
        <div className="space-y-0">
          {thresholds.slice().reverse().map((t, i) => (
            <div key={t.version} className="flex gap-4 pb-4">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  t.version === currentThresholdVersion
                    ? 'bg-amber-500 text-gray-900'
                    : 'bg-gray-800 text-gray-400'
                }`}>
                  {t.version}
                </div>
                {i < thresholds.length - 1 && <div className="w-px flex-1 bg-gray-800/60 mt-1" />}
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-gray-200">v{t.version}</span>
                  {t.version === currentThresholdVersion && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">当前</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" />{t.modifiedBy}</span>
                  <span>{new Date(t.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{t.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function VersionCompare() {
  const thresholds = useStore(s => s.thresholds)
  const [v1, setV1] = useState(0)
  const [v2, setV2] = useState(0)

  if (thresholds.length < 2) return null

  const t1 = thresholds.find(t => t.version === v1)
  const t2 = thresholds.find(t => t.version === v2)

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-gray-200">版本对比</h2>
        </div>
      </div>
      <div className="card-body space-y-3">
        <div className="flex gap-3">
          <select className="input-field flex-1 text-xs" value={v1} onChange={e => setV1(Number(e.target.value))}>
            <option value={0}>选择版本 A</option>
            {thresholds.map(t => <option key={t.version} value={t.version}>v{t.version}</option>)}
          </select>
          <span className="text-gray-500 self-center text-xs">vs</span>
          <select className="input-field flex-1 text-xs" value={v2} onChange={e => setV2(Number(e.target.value))}>
            <option value={0}>选择版本 B</option>
            {thresholds.map(t => <option key={t.version} value={t.version}>v{t.version}</option>)}
          </select>
        </div>

        {t1 && t2 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800/40">
                  <th className="text-left py-2 px-2">频段</th>
                  <th className="text-right py-2 px-2">v{t1.version} 安全</th>
                  <th className="text-right py-2 px-2">v{t2.version} 安全</th>
                  <th className="text-right py-2 px-2">v{t1.version} 危险</th>
                  <th className="text-right py-2 px-2">v{t2.version} 危险</th>
                </tr>
              </thead>
              <tbody>
                {t1.bands.map((b, i) => {
                  const b2 = t2.bands[i]
                  if (!b2) return null
                  const safeDiff = b.safeMax !== b2.safeMax
                  const dangerDiff = b.dangerMax !== b2.dangerMax
                  return (
                    <tr key={i} className="border-b border-gray-800/20">
                      <td className="py-1.5 px-2 font-mono-data text-gray-300">{getBandLabel(b)}</td>
                      <td className={`py-1.5 px-2 text-right font-mono-data ${safeDiff ? 'text-amber-400' : 'text-gray-400'}`}>{b.safeMax}</td>
                      <td className={`py-1.5 px-2 text-right font-mono-data ${safeDiff ? 'text-amber-400' : 'text-gray-400'}`}>{b2.safeMax}</td>
                      <td className={`py-1.5 px-2 text-right font-mono-data ${dangerDiff ? 'text-red-400' : 'text-gray-400'}`}>{b.dangerMax}</td>
                      <td className={`py-1.5 px-2 text-right font-mono-data ${dangerDiff ? 'text-red-400' : 'text-gray-400'}`}>{b2.dangerMax}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Thresholds() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-100">阈值管理</h1>
        <p className="text-xs text-gray-500 mt-1">修改阈值自动生成新版本号，后续计算自动使用最新版本</p>
      </div>

      <ThresholdEditor />
      <VersionTimeline />
      <VersionCompare />
    </div>
  )
}
