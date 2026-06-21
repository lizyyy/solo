import { useMemo, useState } from 'react'
import { FileText, Plus, AlertCircle, CheckCircle } from 'lucide-react'
import { useSupplementStore } from '@/stores/supplementStore'
import {
  parseHoldings,
  serializeHoldings,
  formatHoldingsHuman,
} from '@/stores/supplementStore'
import type { FundHolding } from '@/types'
import { FUND_ASSETS } from '@/data/funds'

interface SupplementFormProps {
  sessionId: string
  currentHoldings: FundHolding[]
  onAdded: () => void
}

const FIELD_OPTIONS = [
  { value: 'score', label: '得分' },
  { value: 'risk', label: '风险' },
  { value: 'holdings', label: '持仓' },
  { value: 'failReason', label: '失败原因' },
] as const

export default function SupplementForm({
  sessionId,
  currentHoldings,
  onAdded,
}: SupplementFormProps) {
  const addSupplement = useSupplementStore((s) => s.addSupplement)
  const [note, setNote] = useState('')
  const [field, setField] = useState<string>('score')
  const [valueBefore, setValueBefore] = useState('')
  const [valueAfter, setValueAfter] = useState('')

  const isHoldingsField = field === 'holdings'

  const beforeHoldings = useMemo(
    () => (isHoldingsField ? parseHoldings(valueBefore) : null),
    [isHoldingsField, valueBefore]
  )
  const afterHoldings = useMemo(
    () => (isHoldingsField ? parseHoldings(valueAfter) : null),
    [isHoldingsField, valueAfter]
  )
  const afterHoldingsValid = isHoldingsField && afterHoldings !== null && afterHoldings.length > 0

  const handleFieldChange = (next: string) => {
    setField(next)
    if (next === 'holdings') {
      setValueBefore(serializeHoldings(currentHoldings))
      setValueAfter(serializeHoldings(currentHoldings))
    } else {
      setValueBefore('')
      setValueAfter('')
    }
  }

  const handleSubmit = () => {
    if (!field) return
    if (isHoldingsField) {
      if (valueBefore.trim() === '' || valueAfter.trim() === '') return
      const before = parseHoldings(valueBefore)
      const after = parseHoldings(valueAfter)
      if (after.length === 0) return
      void before
    } else {
      if (!valueBefore || !valueAfter) return
    }

    addSupplement(sessionId, {
      id: `sup-${Date.now()}`,
      sessionId,
      note,
      field,
      valueBefore,
      valueAfter,
      supplementedAt: Date.now(),
    })

    setNote('')
    setValueBefore('')
    setValueAfter('')
    onAdded()
  }

  const canSubmit =
    field !== '' &&
    (isHoldingsField
      ? valueBefore.trim() !== '' && valueAfter.trim() !== '' && afterHoldingsValid
      : valueBefore !== '' && valueAfter !== '')

  return (
    <div className="card-cafe flex flex-col gap-3">
      <div className="flex items-center gap-2 text-cafe-brown font-medium">
        <FileText className="w-4 h-4" />
        <span>补录记录</span>
      </div>

      <textarea
        className="w-full rounded-lg border border-cafe-latte/60 bg-white px-3 py-2 text-sm text-cafe-brown placeholder:text-cafe-brown/40 focus:outline-none focus:ring-2 focus:ring-cafe-latte resize-none"
        rows={2}
        placeholder="输入补录备注..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <select
        className="w-full rounded-lg border border-cafe-latte/60 bg-white px-3 py-2 text-sm text-cafe-brown focus:outline-none focus:ring-2 focus:ring-cafe-latte"
        value={field}
        onChange={(e) => handleFieldChange(e.target.value)}
      >
        {FIELD_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {isHoldingsField ? (
        <div className="space-y-2">
          <div className="text-xs text-cafe-brown/60 bg-cafe-cream/60 rounded-lg px-3 py-2">
            <p className="font-medium mb-1">持仓输入格式：</p>
            <p>JSON 数组，每项含 <code className="bg-white px-1 rounded">fundId</code> 和 <code className="bg-white px-1 rounded">ratio</code>（0-1 小数）。</p>
            <p className="mt-1">可用基金：</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {FUND_ASSETS.map((f) => (
                <span key={f.id} className="text-xs bg-white px-1.5 py-0.5 rounded border border-cafe-latte/40">
                  {f.id} - {f.name}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-cafe-brown/60 mb-1">修改前（原始持仓 JSON）</label>
            <textarea
              className="w-full rounded-lg border border-cafe-latte/60 bg-white px-3 py-2 text-xs font-mono text-cafe-brown placeholder:text-cafe-brown/40 focus:outline-none focus:ring-2 focus:ring-cafe-latte resize-none"
              rows={3}
              placeholder='[{"fundId":"bond-gov","ratio":0.6}]'
              value={valueBefore}
              onChange={(e) => setValueBefore(e.target.value)}
            />
            {beforeHoldings && (
              <div className="mt-1 text-xs text-cafe-brown/70 flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3 text-safe-green" />
                解析: {formatHoldingsHuman(beforeHoldings)}
              </div>
            )}
            {valueBefore && !beforeHoldings && (
              <div className="mt-1 text-xs text-risk-red flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" />
                JSON 格式无效
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-cafe-brown/60 mb-1">修改后（补录持仓 JSON）</label>
            <textarea
              className="w-full rounded-lg border border-cafe-latte/60 bg-white px-3 py-2 text-xs font-mono text-cafe-brown placeholder:text-cafe-brown/40 focus:outline-none focus:ring-2 focus:ring-cafe-latte resize-none"
              rows={3}
              placeholder='[{"fundId":"bond-gov","ratio":0.6},{"fundId":"mixed-balanced","ratio":0.35}]'
              value={valueAfter}
              onChange={(e) => setValueAfter(e.target.value)}
            />
            {afterHoldings && (
              <div className="mt-1 text-xs text-safe-green flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3" />
                解析: {formatHoldingsHuman(afterHoldings)}
              </div>
            )}
            {valueAfter && !afterHoldings && (
              <div className="mt-1 text-xs text-risk-red flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" />
                JSON 格式无效
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <input
            className="w-full rounded-lg border border-cafe-latte/60 bg-white px-3 py-2 text-sm text-cafe-brown placeholder:text-cafe-brown/40 focus:outline-none focus:ring-2 focus:ring-cafe-latte"
            placeholder="修改前值"
            value={valueBefore}
            onChange={(e) => setValueBefore(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-cafe-latte/60 bg-white px-3 py-2 text-sm text-cafe-brown placeholder:text-cafe-brown/40 focus:outline-none focus:ring-2 focus:ring-cafe-latte"
            placeholder="修改后值"
            value={valueAfter}
            onChange={(e) => setValueAfter(e.target.value)}
          />
        </div>
      )}

      <button
        className="flex items-center justify-center gap-1.5 rounded-lg bg-cafe-brown px-4 py-2 text-sm font-medium text-white hover:bg-cafe-brown/90 transition-colors disabled:opacity-40"
        onClick={handleSubmit}
        disabled={!canSubmit}
      >
        <Plus className="w-4 h-4" />
        添加补录
      </button>
    </div>
  )
}
