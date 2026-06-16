import { useState } from 'react'
import { useStore } from '@/store/useStore'
import type { SourceType } from '@/types'
import { Plus, Camera, PenLine, Archive } from 'lucide-react'

const sourceIcons: Record<SourceType, typeof Camera> = {
  photo: Camera,
  manual: PenLine,
  legacy: Archive,
}

const sourceLabels: Record<SourceType, string> = {
  photo: '现场照片',
  manual: '手工记录',
  legacy: '旧口径补录',
}

export default function RecordForm() {
  const addRecord = useStore((s) => s.addRecord)
  const [form, setForm] = useState({
    timestamp: new Date().toISOString().slice(0, 19),
    springStiffness: '',
    stiffnessUnit: 'N/mm',
    displacement: '',
    displacementUnit: 'mm',
    force: '',
    forceUnit: 'N',
    direction: '+' as '+' | '-',
    sourceType: 'photo' as SourceType,
    sourceReference: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addRecord({
      timestamp: form.timestamp,
      springStiffness: parseFloat(form.springStiffness) || 0,
      stiffnessUnit: form.stiffnessUnit,
      displacement: parseFloat(form.displacement) || 0,
      displacementUnit: form.displacementUnit,
      force: parseFloat(form.force) || 0,
      forceUnit: form.forceUnit,
      direction: form.direction,
      source: { type: form.sourceType, reference: form.sourceReference },
    })
    setForm((prev) => ({
      ...prev,
      springStiffness: '',
      displacement: '',
      force: '',
      sourceReference: '',
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-slate-400">时间戳</label>
          <input
            type="datetime-local"
            value={form.timestamp}
            onChange={(e) => setForm({ ...form, timestamp: e.target.value })}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">弹簧刚度</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={form.springStiffness}
              onChange={(e) =>
                setForm({ ...form, springStiffness: e.target.value })
              }
              placeholder="25.5"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
            />
            <select
              value={form.stiffnessUnit}
              onChange={(e) =>
                setForm({ ...form, stiffnessUnit: e.target.value })
              }
              className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-slate-200"
            >
              <option value="N/mm">N/mm</option>
              <option value="N/cm">N/cm</option>
              <option value="N/m">N/m</option>
              <option value="kN/m">kN/m</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">位移</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={form.displacement}
              onChange={(e) =>
                setForm({ ...form, displacement: e.target.value })
              }
              placeholder="15.2"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
            />
            <select
              value={form.displacementUnit}
              onChange={(e) =>
                setForm({ ...form, displacementUnit: e.target.value })
              }
              className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-slate-200"
            >
              <option value="mm">mm</option>
              <option value="cm">cm</option>
              <option value="m">m</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">力</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              value={form.force}
              onChange={(e) => setForm({ ...form, force: e.target.value })}
              placeholder="387.6"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
            />
            <select
              value={form.forceUnit}
              onChange={(e) =>
                setForm({ ...form, forceUnit: e.target.value })
              }
              className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-slate-200"
            >
              <option value="N">N</option>
              <option value="kN">kN</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">方向</label>
          <div className="flex gap-2">
            {(['+', '-'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setForm({ ...form, direction: d })}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm font-mono transition-all ${
                  form.direction === d
                    ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                    : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-700/50 pt-4">
        <label className="mb-2 block text-xs font-medium text-slate-400">
          数据来源
        </label>
        <div className="mb-3 flex gap-2">
          {(Object.keys(sourceLabels) as SourceType[]).map((type) => {
            const Icon = sourceIcons[type]
            return (
              <button
                key={type}
                type="button"
                onClick={() => setForm({ ...form, sourceType: type })}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all ${
                  form.sourceType === type
                    ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                    : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                }`}
              >
                <Icon className="h-3 w-3" />
                {sourceLabels[type]}
              </button>
            )
          })}
        </div>
        <input
          type="text"
          value={form.sourceReference}
          onChange={(e) =>
            setForm({ ...form, sourceReference: e.target.value })
          }
          placeholder={
            form.sourceType === 'photo'
              ? '照片编号，如 IMG_20260520_001'
              : form.sourceType === 'manual'
                ? '记录本页码'
                : '旧报告编号'
          }
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-orange-600 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        录入记录
      </button>
    </form>
  )
}
