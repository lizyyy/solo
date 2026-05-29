import { useState, useEffect } from 'react'
import { Material, MaterialType, FREQUENCY_BANDS, FREQ_BAND_LABELS, MATERIAL_TYPE_LABELS } from '@/types'
import { useMaterialStore } from '@/store/materialStore'

interface MaterialFormProps {
  material: Material | null
  onSave: (material: Material) => void
  onCancel: () => void
}

export default function MaterialForm({ material, onSave, onCancel }: MaterialFormProps) {
  const createEmptyMaterial = useMaterialStore((s) => s.createEmptyMaterial)
  const [form, setForm] = useState<Material>(material ?? createEmptyMaterial())
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setForm(material ?? createEmptyMaterial())
  }, [material])

  const update = <K extends keyof Material>(key: K, value: Material[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateCoeff = (freq: typeof FREQUENCY_BANDS[number], value: string) => {
    const num = value === '' ? null : parseFloat(value)
    const invalid = num !== null && (num < 0 || num > 1)
    setErrors((prev) => ({ ...prev, [freq]: invalid }))
    setForm((prev) => ({
      ...prev,
      coefficients: { ...prev.coefficients, [freq]: num },
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const hasErrors = FREQUENCY_BANDS.some((f) => {
      const v = form.coefficients[f]
      return v !== null && (v < 0 || v > 1)
    })
    if (hasErrors) return
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl bg-[#1e3a33] border border-[#2a4a40] p-6 shadow-2xl"
      >
        <h2 className="mb-5 text-lg font-semibold text-white">
          {material ? '编辑材料' : '添加材料'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-gray-400">名称</label>
            <input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full rounded bg-[#142420] border border-[#2a4a40] px-3 py-2 text-sm text-white focus:border-[#e8a838] focus:outline-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-400">类型</label>
              <select
                value={form.type}
                onChange={(e) => update('type', e.target.value as MaterialType)}
                className="w-full rounded bg-[#142420] border border-[#2a4a40] px-3 py-2 text-sm text-white focus:border-[#e8a838] focus:outline-none"
              >
                {(Object.entries(MATERIAL_TYPE_LABELS) as [MaterialType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs text-gray-400">单价 ¥</label>
              <input
                type="number"
                min={0}
                value={form.unitPrice || ''}
                onChange={(e) => update('unitPrice', Number(e.target.value))}
                className="w-full rounded bg-[#142420] border border-[#2a4a40] px-3 py-2 text-sm text-white focus:border-[#e8a838] focus:outline-none"
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs text-gray-400">厚度 mm</label>
              <input
                type="number"
                min={0}
                value={form.thickness || ''}
                onChange={(e) => update('thickness', Number(e.target.value))}
                className="w-full rounded bg-[#142420] border border-[#2a4a40] px-3 py-2 text-sm text-white focus:border-[#e8a838] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-400">吸声系数 (0–1)</label>
            <div className="grid grid-cols-6 gap-2">
              {FREQUENCY_BANDS.map((freq) => {
                const val = form.coefficients[freq]
                const invalid = errors[freq]
                return (
                  <div key={freq}>
                    <span className="mb-0.5 block text-center text-[10px] text-gray-500">
                      {FREQ_BAND_LABELS[freq]}
                    </span>
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      max={1}
                      value={val ?? ''}
                      onChange={(e) => updateCoeff(freq, e.target.value)}
                      className={`w-full rounded bg-[#142420] px-2 py-1.5 text-center text-sm text-white focus:outline-none ${
                        invalid
                          ? 'border-2 border-red-500 animate-shake'
                          : 'border border-[#2a4a40] focus:border-[#e8a838]'
                      }`}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-400">备注</label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={2}
              className="w-full rounded bg-[#142420] border border-[#2a4a40] px-3 py-2 text-sm text-white focus:border-[#e8a838] focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-[#2a4a40] px-4 py-2 text-sm text-gray-300 hover:bg-[#2a4a40] transition"
          >
            取消
          </button>
          <button
            type="submit"
            className="rounded bg-[#e8a838] px-4 py-2 text-sm font-semibold text-[#1a2f2a] hover:bg-[#d4952e] transition"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  )
}
