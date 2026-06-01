import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { SAMPLE_DATA } from '@/data/sampleData'
import { categorizeValidation } from '@/utils/validation'
import type { ExhibitPoint, ValidationResult, ValidationCategory } from '@/types'
import {
  Upload,
  FileJson,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Database,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_BORDER: Record<ValidationResult['status'], string> = {
  valid: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  uncalculable: 'border-l-red-500',
}

const ISSUE_CATEGORIES: {
  key: ValidationCategory
  label: string
  Icon: typeof AlertCircle
  border: string
}[] = [
  { key: 'null_value', label: '空值记录', Icon: AlertCircle, border: 'border-l-red-500' },
  { key: 'duplicate', label: '重复展点', Icon: AlertTriangle, border: 'border-l-amber-500' },
  { key: 'unit_mismatch', label: '单位不一致', Icon: AlertCircle, border: 'border-l-amber-500' },
  { key: 'suspicious', label: '疑似异常', Icon: AlertTriangle, border: 'border-l-amber-500' },
]

function NullCell() {
  return <span className="text-red-400 italic text-xs">空</span>
}

function DataPreviewTable() {
  const points = useAppStore((s) => s.points)
  const validationResults = useAppStore((s) => s.validationResults)

  if (points.length === 0) return null

  const resultMap = new Map(validationResults.map((r) => [r.pointId, r]))

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-left text-slate-400">
            <th className="px-2 py-1.5 font-medium">ID</th>
            <th className="px-2 py-1.5 font-medium">名称</th>
            <th className="px-2 py-1.5 font-medium">x</th>
            <th className="px-2 py-1.5 font-medium">y</th>
            <th className="px-2 py-1.5 font-medium">楼层</th>
            <th className="px-2 py-1.5 font-medium">停留(分)</th>
            <th className="px-2 py-1.5 font-medium">单位</th>
            <th className="px-2 py-1.5 font-medium">分类</th>
          </tr>
        </thead>
        <tbody className="text-slate-300">
          {points.map((p) => {
            const result = resultMap.get(p.id)
            const isSuspicious =
              p.estimatedStayMinutes !== null && p.estimatedStayMinutes > 120
            return (
              <tr
                key={p.id}
                className={cn(
                  'border-l-4',
                  result ? STATUS_BORDER[result.status] : 'border-l-slate-600',
                )}
              >
                <td className="px-2 py-1.5 font-mono text-xs">{p.id}</td>
                <td className="px-2 py-1.5">{p.name}</td>
                <td className="px-2 py-1.5 font-mono">
                  {p.x ?? <NullCell />}
                </td>
                <td className="px-2 py-1.5 font-mono">
                  {p.y ?? <NullCell />}
                </td>
                <td className="px-2 py-1.5 font-mono">{p.floor}</td>
                <td
                  className={cn(
                    'px-2 py-1.5 font-mono',
                    isSuspicious && 'rounded bg-amber-500/20 text-amber-400',
                  )}
                >
                  {p.estimatedStayMinutes ?? <NullCell />}
                </td>
                <td className="px-2 py-1.5 font-mono">{p.unit}</td>
                <td className="px-2 py-1.5">{p.category}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function ImportPage() {
  const points = useAppStore((s) => s.points)
  const validationResults = useAppStore((s) => s.validationResults)
  const loadPoints = useAppStore((s) => s.loadPoints)
  const clearAll = useAppStore((s) => s.clearAll)

  const [jsonInput, setJsonInput] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [importCount, setImportCount] = useState<number | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<ValidationCategory>>(
    new Set(),
  )

  const handleLoadSample = () => {
    loadPoints(SAMPLE_DATA)
    setParseError(null)
    setImportCount(null)
  }

  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonInput)
      if (!Array.isArray(parsed)) throw new Error('数据必须为数组格式')
      loadPoints(parsed as ExhibitPoint[])
      setImportCount(parsed.length)
      setParseError(null)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'JSON 解析失败')
      setImportCount(null)
    }
  }

  const toggleCategory = (key: ValidationCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const stats = {
    valid: validationResults.filter((r) => r.status === 'valid').length,
    warning: validationResults.filter((r) => r.status === 'warning').length,
    uncalculable: validationResults.filter((r) => r.status === 'uncalculable').length,
  }

  const categories = categorizeValidation(validationResults)
  const pointMap = new Map(points.map((p) => [p.id, p]))

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Database className="h-6 w-6 text-amber-500" />
        <div>
          <h1 className="text-xl font-bold text-white">数据导入与校验</h1>
          <p className="text-sm text-slate-400">
            处理脏数据：空值、重复、单位混用、异常值，确保优化输入质量
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">样例数据</h2>
            <p className="mt-1 text-sm text-slate-400">
              包含空值、重复点、单位混用、疑似异常等常见数据问题
            </p>
          </div>
          <div className="flex gap-2">
            {points.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1.5 rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700"
              >
                <Trash2 className="h-4 w-4" />
                清除
              </button>
            )}
            <button
              onClick={handleLoadSample}
              className="flex items-center gap-1.5 rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-400"
            >
              <Sparkles className="h-4 w-4" />
              加载样例数据
            </button>
          </div>
        </div>
        <DataPreviewTable />
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <div className="mb-4 flex items-center gap-2">
          <FileJson className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-white">JSON 导入</h2>
        </div>
        <textarea
          value={jsonInput}
          onChange={(e) => {
            setJsonInput(e.target.value)
            setParseError(null)
            setImportCount(null)
          }}
          placeholder='粘贴 JSON 数组，例如：[{"id":"P01","name":"展点A","x":10,"y":20,"floor":1,"estimatedStayMinutes":15,"unit":"m","category":"常设展"}]'
          className="w-full rounded-md border border-slate-600 bg-slate-900 p-3 font-mono text-sm text-slate-300 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none"
          rows={6}
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleImport}
            className="flex items-center gap-1.5 rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-400"
          >
            <Upload className="h-4 w-4" />
            导入数据
          </button>
          {parseError && <span className="text-sm text-red-400">{parseError}</span>}
          {importCount !== null && (
            <span className="text-sm text-emerald-400">
              成功导入 {importCount} 条数据
            </span>
          )}
        </div>
      </div>

      {validationResults.length > 0 && (
        <div className="animate-in fade-in rounded-lg border border-slate-700 bg-slate-800 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">校验结果</h2>

          <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm">合格</span>
              </div>
              <p className="mt-1 font-mono text-2xl font-bold text-emerald-400">
                {stats.valid}
              </p>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm">警告</span>
              </div>
              <p className="mt-1 font-mono text-2xl font-bold text-amber-400">
                {stats.warning}
              </p>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="h-5 w-5" />
                <span className="text-sm">无法计算</span>
              </div>
              <p className="mt-1 font-mono text-2xl font-bold text-red-400">
                {stats.uncalculable}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {ISSUE_CATEGORIES.map(({ key, label, Icon, border }) => {
              const items = categories[key]
              if (!items || items.length === 0) return null
              const isExpanded = expandedCategories.has(key)
              return (
                <div
                  key={key}
                  className={cn('rounded-md border-l-4 bg-slate-900/50', border)}
                >
                  <button
                    onClick={() => toggleCategory(key)}
                    className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-slate-700/50"
                  >
                    <div className="flex items-center gap-2 text-slate-200">
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{label}</span>
                      <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                        {items.length}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'text-xs text-slate-500 transition-transform duration-200',
                        isExpanded && 'rotate-180',
                      )}
                    >
                      ▼
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-700 px-3 pb-2">
                      {items.map((result) => {
                        const point = pointMap.get(result.pointId)
                        return (
                          <div
                            key={result.pointId}
                            className={cn(
                              'my-1 border-l-2 py-2 pl-3',
                              STATUS_BORDER[result.status],
                            )}
                          >
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium text-slate-200">
                                {point?.name ?? result.pointId}
                              </span>
                              <span className="font-mono text-xs text-slate-500">
                                {result.pointId}
                              </span>
                              {result.status === 'uncalculable' && (
                                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
                                  无法计算
                                </span>
                              )}
                            </div>
                            {result.reasons.map((reason, i) => (
                              <p key={i} className="mt-0.5 text-xs text-slate-400">
                                {reason}
                              </p>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
