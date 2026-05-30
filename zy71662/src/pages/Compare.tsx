import { useState, useEffect, useCallback } from 'react'
import { ArrowUp, ArrowDown, ArrowRight } from 'lucide-react'
import * as api from '@/lib/api'
import { useStore } from '@/store/useStore'
import type { SchemeDetail, LoadVerification, RiskItem } from '../../shared/types'

interface SchemeData {
  detail: SchemeDetail
  verifications: LoadVerification[]
  risks: RiskItem[]
}

interface MetricRow {
  label: string
  values: (number | string)[]
  lowerIsBetter: boolean
}

function computeMetrics(data: SchemeData): MetricRow[] {
  const { detail, verifications, risks } = data
  const pointCount = detail.points.length
  const totalLoad = detail.points.reduce((s, p) => s + p.ratedLoad, 0)
  const maxSingleLoad = verifications.length
    ? Math.max(...verifications.map((v) => v.actualLoadKg))
    : 0
  const maxLoadRatio = verifications.length
    ? Math.max(...verifications.map((v) => v.loadRatio))
    : 0
  const minSafetyMargin = 1 - maxLoadRatio
  const riskCount = risks.length
  const overloadCount = verifications.filter((v) => v.status === 'overload').length
  const safetyFactor = detail.scheme.safetyFactor

  return [
    { label: '吊点数量', values: [pointCount], lowerIsBetter: false },
    { label: '总载荷 (kg)', values: [totalLoad], lowerIsBetter: false },
    { label: '最大单点载荷 (kg)', values: [maxSingleLoad], lowerIsBetter: true },
    { label: '最小安全裕度', values: [minSafetyMargin], lowerIsBetter: false },
    { label: '风险项数', values: [riskCount], lowerIsBetter: true },
    { label: '超载吊点', values: [overloadCount], lowerIsBetter: true },
    { label: '安全系数', values: [safetyFactor], lowerIsBetter: false },
  ]
}

function CompareCell({ value, isBest, isWorst, lowerIsBetter }: {
  value: number | string
  isBest: boolean
  isWorst: boolean
  lowerIsBetter: boolean
}) {
  const num = typeof value === 'number' ? value : parseFloat(value as string)
  const display = typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : value

  if (!isBest && !isWorst) {
    return <span className="font-mono text-sm tabular-nums text-zinc-200">{display}</span>
  }

  const best = lowerIsBetter ? isBest : isBest
  const color = best ? 'text-green-400' : 'text-red-400'
  const Icon = best ? ArrowUp : ArrowDown

  return (
    <span className={`font-mono text-sm tabular-nums inline-flex items-center gap-1 ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {display}
    </span>
  )
}

export default function Compare() {
  const { schemes, fetchSchemes } = useStore()
  const [selectedIds, setSelectedIds] = useState<[string?, string?, string?]>([undefined, undefined, undefined])
  const [schemeDataMap, setSchemeDataMap] = useState<Map<string, SchemeData>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchSchemes()
  }, [fetchSchemes])

  const loadSchemeData = useCallback(async (id: string) => {
    if (schemeDataMap.has(id)) return
    setLoading(true)
    try {
      const [detail, verifications, risks] = await Promise.all([
        api.getScheme(id),
        api.verify(id),
        api.getRisks(id),
      ])
      setSchemeDataMap((prev) => {
        const next = new Map(prev)
        next.set(id, { detail, verifications, risks })
        return next
      })
    } catch {
      // ignore
    }
    setLoading(false)
  }, [schemeDataMap])

  useEffect(() => {
    selectedIds.forEach((id) => {
      if (id) loadSchemeData(id)
    })
  }, [selectedIds, loadSchemeData])

  const activeIds = selectedIds.filter(Boolean) as string[]
  const allMetrics: { label: string; values: (number | string)[]; lowerIsBetter: boolean }[] = []

  if (activeIds.length >= 2) {
    const metricSets = activeIds.map((id) => {
      const data = schemeDataMap.get(id)
      return data ? computeMetrics(data) : null
    })

    if (metricSets.every(Boolean)) {
      const labels = (metricSets[0]!).map((m) => m.label)
      labels.forEach((label, i) => {
        const values = metricSets.map((m) => m![i].values[0])
        const lowerIsBetter = metricSets[0]![i].lowerIsBetter
        allMetrics.push({ label, values, lowerIsBetter })
      })
    }
  }

  const handleSelect = (index: 0 | 1 | 2, id: string) => {
    setSelectedIds((prev) => {
      const next: [string?, string?, string?] = [...prev]
      next[index] = id || undefined
      return next
    })
  }

  if (activeIds.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-400">
        <ArrowRight className="w-10 h-10 text-zinc-600" />
        <p className="text-lg">请选择至少两个方案进行对比</p>
        <div className="flex gap-3 mt-2">
          {([0, 1, 2] as const).map((i) => (
            <select
              key={i}
              className="select-field min-w-[180px]"
              value={selectedIds[i] || ''}
              onChange={(e) => handleSelect(i, e.target.value)}
            >
              <option value="">{i === 2 ? '方案C (可选)' : `方案${String.fromCharCode(65 + i)}`}</option>
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          ))}
        </div>
      </div>
    )
  }

  const colLabels = ['方案A', '方案B', '方案C']

  return (
    <div className="p-6 space-y-6">
      <div className="flex gap-3 items-end">
        {([0, 1, 2] as const).map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">{colLabels[i]}{i === 2 ? ' (可选)' : ''}</label>
            <select
              className="select-field min-w-[180px]"
              value={selectedIds[i] || ''}
              onChange={(e) => handleSelect(i, e.target.value)}
            >
              <option value="">未选择</option>
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {loading && <p className="text-zinc-400 text-sm">加载中...</p>}

      {allMetrics.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-700/50">
                <th className="px-4 py-3 text-sm font-medium text-zinc-400">指标</th>
                {activeIds.map((_, i) => (
                  <th key={i} className="px-4 py-3 text-sm font-medium text-brand-accent">{colLabels[i]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allMetrics.map((row) => {
                const nums = row.values.map((v) => typeof v === 'number' ? v : parseFloat(v as string))
                const best = row.lowerIsBetter ? Math.min(...nums) : Math.max(...nums)
                const worst = row.lowerIsBetter ? Math.max(...nums) : Math.min(...nums)
                return (
                  <tr key={row.label} className="border-b border-zinc-700/30 hover:bg-brand-mid/30">
                    <td className="px-4 py-3 text-sm text-zinc-300">{row.label}</td>
                    {row.values.map((val, i) => (
                      <td key={i} className="px-4 py-3">
                        <CompareCell
                          value={val}
                          isBest={nums[i] === best && best !== worst}
                          isWorst={nums[i] === worst && best !== worst}
                          lowerIsBetter={row.lowerIsBetter}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
