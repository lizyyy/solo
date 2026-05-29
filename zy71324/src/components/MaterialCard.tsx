import { Pencil, Trash2 } from 'lucide-react'
import {
  Material,
  ValidationIssue,
  MATERIAL_TYPE_LABELS,
  MATERIAL_TYPE_COLORS,
  LOW_FREQ_BANDS,
  MID_FREQ_BANDS,
  HIGH_FREQ_BANDS,
} from '@/types'

interface MaterialCardProps {
  material: Material
  issues: ValidationIssue[]
  onEdit: (material: Material) => void
  onDelete: (id: string) => void
}

function freqAvg(material: Material, bands: typeof LOW_FREQ_BANDS): string {
  const vals = bands.map((b) => material.coefficients[b]).filter((v): v is number => v !== null)
  return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '—'
}

export default function MaterialCard({ material, issues, onEdit, onDelete }: MaterialCardProps) {
  const hasMissing = issues.some((i) => i.materialId === material.id && i.type === 'frequency_missing')
  const hasOutOfRange = issues.some((i) => i.materialId === material.id && i.type === 'coefficient_out_of_range')
  const barColor = MATERIAL_TYPE_COLORS[material.type]

  return (
    <div className="relative rounded-lg bg-[#1e3a33] border border-[#2a4a40] overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: barColor }} />

      {hasOutOfRange && (
        <span className="absolute top-3 right-3 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          系数越界
        </span>
      )}

      {hasMissing && (
        <span className="absolute top-3 right-3 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-[#1a2f2a]">
          缺频数据
        </span>
      )}

      <div className="p-4">
        <h3 className="text-base font-semibold text-white truncate pr-20">{material.name || '(未命名)'}</h3>
        <p className="mt-0.5 text-xs" style={{ color: barColor }}>
          {MATERIAL_TYPE_LABELS[material.type]}
        </p>

        <div className="mt-3 flex gap-3 text-xs text-gray-400">
          <span>厚度 {material.thickness}mm</span>
          <span>¥{material.unitPrice}/m²</span>
        </div>

        <div className="mt-3 flex gap-2">
          <span className="inline-flex items-center rounded bg-emerald-900/50 px-2 py-0.5 text-[11px] text-emerald-300">
            低 {freqAvg(material, LOW_FREQ_BANDS)}
          </span>
          <span className="inline-flex items-center rounded bg-sky-900/50 px-2 py-0.5 text-[11px] text-sky-300">
            中 {freqAvg(material, MID_FREQ_BANDS)}
          </span>
          <span className="inline-flex items-center rounded bg-amber-900/50 px-2 py-0.5 text-[11px] text-amber-300">
            高 {freqAvg(material, HIGH_FREQ_BANDS)}
          </span>
        </div>

        <div className="mt-3 flex justify-end gap-1">
          <button
            onClick={() => onEdit(material)}
            className="rounded p-1.5 text-gray-400 transition hover:bg-[#2a4a40] hover:text-white"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => onDelete(material.id)}
            className="rounded p-1.5 text-gray-400 transition hover:bg-red-900/40 hover:text-red-400"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
