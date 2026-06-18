import { useMemo, useState } from 'react'
import {
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  FileText,
  X,
  Trash2,
} from 'lucide-react'
import { useAnomalyStore } from '@/hooks/useAnomalyStore'
import { detectCoordReversal } from '@/utils/coordCheck'
import { makeShipKey } from '@/utils/dedup'
import type { ShipRecord } from '@/utils/types'

const SAMPLE_JSON = `[
  {
    "buoyId": "BY-001",
    "recordTimestamp": "2026-06-15T10:00:00Z",
    "recordLat": 30.5234,
    "recordLng": 122.3102,
    "waterTemp": 25.1,
    "salinity": 33.2,
    "dissolvedOxygen": 7.5,
    "phValue": 8.1,
    "isBoundarySample": false,
    "linkedAnomalyId": "<关联的异常记录ID，可留空>"
  }
]`

type ValidState = 'normal' | 'duplicate' | 'coord' | 'boundary'

interface ParsedShipRecord extends ShipRecord {
  _valid: ValidState
  _reason?: string
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return iso
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function validateShipRecord(raw: unknown, existingKeys: Set<string>): ParsedShipRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const buoyId = typeof r.buoyId === 'string' ? r.buoyId : ''
  const recordTimestamp = typeof r.recordTimestamp === 'string' ? r.recordTimestamp : ''
  if (!buoyId || !recordTimestamp) return null

  const recordLat = typeof r.recordLat === 'number' ? r.recordLat : parseFloat(String(r.recordLat || '0'))
  const recordLng = typeof r.recordLng === 'number' ? r.recordLng : parseFloat(String(r.recordLng || '0'))
  const waterTemp = typeof r.waterTemp === 'number' ? r.waterTemp : parseFloat(String(r.waterTemp || '0'))
  const salinity = typeof r.salinity === 'number' ? r.salinity : parseFloat(String(r.salinity || '0'))
  const dissolvedOxygen =
    typeof r.dissolvedOxygen === 'number' ? r.dissolvedOxygen : parseFloat(String(r.dissolvedOxygen || '0'))
  const phValue = typeof r.phValue === 'number' ? r.phValue : parseFloat(String(r.phValue || '0'))
  const isBoundarySample = !!r.isBoundarySample
  const linkedAnomalyId = typeof r.linkedAnomalyId === 'string' ? r.linkedAnomalyId : uuid()

  const key = makeShipKey({ buoyId, recordTimestamp })
  let _valid: ValidState = 'normal'
  let _reason: string | undefined

  if (existingKeys.has(key)) {
    _valid = 'duplicate'
    _reason = '已存在相同浮标编号 + 时间戳的记录'
  } else {
    const check = detectCoordReversal(recordLat, recordLng)
    if (check.reversed) {
      _valid = 'coord'
      _reason = check.reason
    } else if (isBoundarySample) {
      _valid = 'boundary'
    }
  }

  return {
    id: uuid(),
    buoyId,
    recordTimestamp,
    recordLat,
    recordLng,
    waterTemp,
    salinity,
    dissolvedOxygen,
    phValue,
    isBoundarySample,
    linkedAnomalyId,
    _valid,
    _reason,
  }
}

const validBadge: Record<ValidState, { label: string; cls: string }> = {
  normal: { label: '正常', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  duplicate: { label: '重复', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  coord: { label: '经纬反写', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  boundary: { label: '边界样本', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
}

function validIcon(s: ValidState) {
  switch (s) {
    case 'normal':
      return <CheckCircle2 className="w-4 h-4" />
    case 'duplicate':
      return <XCircle className="w-4 h-4" />
    case 'coord':
      return <AlertTriangle className="w-4 h-4" />
    case 'boundary':
      return <Sparkles className="w-4 h-4" />
  }
}

function ImportResultModal({
  result,
  onClose,
}: {
  result: { added: number; skipped: number; boundary: number; suspended: number }
  onClose: () => void
}) {
  const stats = [
    { label: '新增记录', value: result.added, cls: 'text-emerald-400', icon: <CheckCircle2 className="w-5 h-5" /> },
    { label: '跳过重复', value: result.skipped, cls: 'text-slate-400', icon: <XCircle className="w-5 h-5" /> },
    { label: '边界样本', value: result.boundary, cls: 'text-blue-400', icon: <Sparkles className="w-5 h-5" /> },
    { label: '挂起待确认', value: result.suspended, cls: 'text-[#FF6B35]', icon: <AlertCircle className="w-5 h-5" /> },
  ]
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-[#1E293B] border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#00E5A0]/15 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#00E5A0]" />
            </div>
            <h2 className="text-xl font-bold text-slate-100">导入结果</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-700/50 flex items-center justify-center text-slate-400 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-[#0F172A] rounded-xl p-4 border border-slate-800">
              <div className={`flex items-center gap-2 mb-2 ${s.cls}`}>
                {s.icon}
                <span className="text-xs text-slate-400">{s.label}</span>
              </div>
              <p className={`font-mono text-3xl font-bold ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-[#00E5A0] hover:bg-[#00cc8e] text-[#0A2540] font-semibold rounded-xl transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  )
}

export default function ImportPage() {
  const shipRecords = useAnomalyStore((s) => s.shipRecords)
  const anomalies = useAnomalyStore((s) => s.anomalies)
  const importShipRecords = useAnomalyStore((s) => s.importShipRecords)

  const [inputText, setInputText] = useState('')
  const [parsedRecords, setParsedRecords] = useState<ParsedShipRecord[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [importResult, setImportResult] = useState({ added: 0, skipped: 0, boundary: 0, suspended: 0 })
  const [parseError, setParseError] = useState('')

  const existingKeys = useMemo(() => new Set(shipRecords.map(makeShipKey)), [shipRecords])

  const handleParse = () => {
    setParseError('')
    try {
      const parsed = JSON.parse(inputText)
      if (!Array.isArray(parsed)) {
        setParseError('输入必须是 JSON 数组格式')
        setShowPreview(false)
        return
      }
      if (parsed.length > 20) {
        setParseError('单次导入不超过 20 条，请分批少量导入')
        setShowPreview(false)
        return
      }
      const validated: ParsedShipRecord[] = []
      for (const item of parsed) {
        const v = validateShipRecord(item, existingKeys)
        if (v) validated.push(v)
      }
      if (validated.length === 0) {
        setParseError('没有解析到有效的船上记录')
        setShowPreview(false)
        return
      }
      setParsedRecords(validated)
      setShowPreview(true)
    } catch (e) {
      setParseError(`JSON 解析失败: ${e instanceof Error ? e.message : String(e)}`)
      setShowPreview(false)
    }
  }

  const handleImport = () => {
    const importable = parsedRecords.filter((r) => r._valid !== 'duplicate').map(({ _valid, _reason, ...rest }) => {
      // 如果没有关联 anomalyId，尝试根据 buoyId + 时间接近度匹配
      let linked = rest.linkedAnomalyId
      if (!linked || linked.includes('<')) {
        const matches = anomalies.filter(
          (a) =>
            a.buoyId === rest.buoyId &&
            Math.abs(new Date(a.sensorTimestamp).getTime() - new Date(rest.recordTimestamp).getTime()) <
              4 * 3600 * 1000
        )
        if (matches.length > 0) {
          linked = matches[0].id
        } else {
          linked = uuid()
        }
      }
      return { ...rest, linkedAnomalyId: linked }
    })
    const skipped = parsedRecords.filter((r) => r._valid === 'duplicate').length
    const result = importShipRecords(importable)
    setImportResult({
      ...result,
      skipped: result.skipped + skipped,
    })
    setShowResult(true)
    setShowPreview(false)
    setInputText('')
    setParsedRecords([])
  }

  const handleClear = () => {
    setInputText('')
    setParsedRecords([])
    setShowPreview(false)
    setParseError('')
  }

  const handleFillSample = () => {
    setInputText(SAMPLE_JSON)
    setShowPreview(false)
    setParseError('')
  }

  return (
    <div className="max-w-6xl space-y-6 text-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#00E5A0]/15 flex items-center justify-center">
            <Upload className="w-6 h-6 text-[#00E5A0]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">船上记录导入</h1>
            <p className="text-sm text-slate-500 mt-0.5">少量批量导入，携带边界样本，系统自动检测重复与经纬度反写</p>
          </div>
        </div>
      </div>

      <div className="bg-[#1E293B]/60 border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            粘贴 JSON 数据
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFillSample}
              className="text-xs text-slate-400 hover:text-[#00E5A0] px-2.5 py-1 rounded-md border border-slate-700 hover:border-[#00E5A0]/40 transition"
            >
              填充示例
            </button>
            <button
              onClick={handleClear}
              className="text-xs text-slate-400 hover:text-red-400 px-2.5 py-1 rounded-md border border-slate-700 hover:border-red-500/40 transition flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              清除
            </button>
          </div>
        </div>
        <textarea
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value)
            setShowPreview(false)
            setParseError('')
          }}
          placeholder={SAMPLE_JSON}
          rows={12}
          spellCheck={false}
          className="w-full bg-[#0F172A] border border-slate-700 rounded-xl p-4 font-mono text-xs text-slate-200 outline-none focus:border-[#00E5A0]/60 focus:ring-1 focus:ring-[#00E5A0]/30 transition resize-none"
        />
        {parseError && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={handleParse}
            disabled={!inputText.trim()}
            className="px-5 py-2.5 bg-[#00E5A0] hover:bg-[#00cc8e] disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-[#0A2540] font-semibold rounded-lg transition-colors shadow-lg shadow-[#00E5A0]/10"
          >
            解析预览
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="bg-[#1E293B]/40 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-400" />
              导入预览
              <span className="ml-1 text-xs text-slate-500 font-normal">共 {parsedRecords.length} 条</span>
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClear}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                className="px-5 py-2 bg-[#00E5A0] hover:bg-[#00cc8e] text-[#0A2540] font-semibold rounded-lg transition-colors"
              >
                确认导入
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#1E293B] sticky top-0 z-10">
                <tr className="text-slate-400 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">浮标编号</th>
                  <th className="text-left px-5 py-3 font-medium">记录时间</th>
                  <th className="text-left px-5 py-3 font-medium">纬度</th>
                  <th className="text-left px-5 py-3 font-medium">经度</th>
                  <th className="text-left px-5 py-3 font-medium">水温</th>
                  <th className="text-left px-5 py-3 font-medium">盐度</th>
                  <th className="text-left px-5 py-3 font-medium">溶解氧</th>
                  <th className="text-left px-5 py-3 font-medium">pH</th>
                  <th className="text-left px-5 py-3 font-medium">边界</th>
                  <th className="text-left px-5 py-3 font-medium">校验状态</th>
                </tr>
              </thead>
              <tbody>
                {parsedRecords.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`border-t border-slate-800/60 ${
                      r._valid === 'coord'
                        ? 'bg-orange-500/10'
                        : r._valid === 'duplicate'
                        ? 'line-through text-slate-500 opacity-60'
                        : r._valid === 'boundary'
                        ? 'border-l-4 border-l-blue-400'
                        : ''
                    }`}
                    style={r._valid === 'boundary' ? { boxShadow: 'inset 4px 0 0 #60a5fa' } : undefined}
                  >
                    <td className="px-5 py-3 font-mono font-semibold text-[#00E5A0]">{r.buoyId}</td>
                    <td className="px-5 py-3 font-mono text-slate-300">{formatDate(r.recordTimestamp)}</td>
                    <td className="px-5 py-3 font-mono">{r.recordLat.toFixed(4)}</td>
                    <td className="px-5 py-3 font-mono">{r.recordLng.toFixed(4)}</td>
                    <td className="px-5 py-3 font-mono">{r.waterTemp.toFixed(1)}</td>
                    <td className="px-5 py-3 font-mono">{r.salinity.toFixed(1)}</td>
                    <td className="px-5 py-3 font-mono">{r.dissolvedOxygen.toFixed(1)}</td>
                    <td className="px-5 py-3 font-mono">{r.phValue.toFixed(1)}</td>
                    <td className="px-5 py-3">
                      {r.isBoundarySample ? (
                        <Sparkles className="w-4 h-4 text-blue-400" />
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={validBadge[r._valid].cls}>{validIcon(r._valid)}</span>
                        <span className={`px-2 py-0.5 rounded border text-xs ${validBadge[r._valid].cls}`}>
                          {validBadge[r._valid].label}
                        </span>
                      </div>
                      {r._reason && <p className="text-[10px] text-slate-500 mt-1">{r._reason}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-[#0A2540]/20 border border-[#00E5A0]/20 rounded-xl p-5">
        <h4 className="font-semibold text-[#00E5A0] text-sm mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          导入规则说明
        </h4>
        <ul className="text-sm text-slate-400 space-y-1.5 list-disc list-inside">
          <li>系统自动检测<strong className="text-slate-300">重复记录</strong>（浮标编号 + 时间戳），重复记录自动跳过，人工备注不被覆盖</li>
          <li>检测到<strong className="text-orange-400">经纬度反写</strong>时自动标记为挂起，等待接手同事人工确认，不给出假稳定结论</li>
          <li>导入时标记<strong className="text-blue-400">边界样本</strong>（正常/异常临界值），方便验证确认逻辑</li>
          <li>船上记录时间<strong className="text-slate-300">晚于传感器数据</strong>属正常情况，详情页会显示时间偏差</li>
        </ul>
      </div>

      {showResult && (
        <ImportResultModal result={importResult} onClose={() => setShowResult(false)} />
      )}
    </div>
  )
}
