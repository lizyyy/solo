import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { getAllUnits, convertToSI, validateDirection, validateTimeInterval } from '@/utils/unitConversion'
import type { SensorRecord } from '@/types'
import { Plus, Trash2, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react'

const UNIT_OPTIONS = getAllUnits()

export default function SensorRecordPanel() {
  const batchId = useStore((s) => s.currentBatchId)
  const batch = useStore((s) => s.batches.find((b) => b.id === s.currentBatchId))
  const addRecord = useStore((s) => s.addSensorRecord)
  const removeRecord = useStore((s) => s.removeSensorRecord)
  const updateRecords = useStore((s) => s.updateSensorRecords)
  const [expanded, setExpanded] = useState(true)

  const records = useMemo(() => batch?.sensorRecords ?? [], [batch])
  const timeValidation = useMemo(() => {
    const timestamps = records.map((r) => r.timestamp).filter(Boolean)
    return validateTimeInterval(timestamps)
  }, [records])

  if (!batchId || !batch) return null

  const handleAdd = () => {
    const r: SensorRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      parameterName: '',
      rawValue: 0,
      rawUnit: 'm',
      standardValue: 0,
      standardUnit: '',
      timestamp: new Date().toISOString().slice(0, 16),
      direction: '',
      source: '手动录入',
      validated: false,
      validationMessage: '',
    }
    addRecord(batchId, r)
  }

  const handleChange = (idx: number, field: keyof SensorRecord, value: string | number) => {
    const updated = records.map((r, i) => {
      if (i !== idx) return r
      const next = { ...r, [field]: value }
      if (field === 'rawValue' || field === 'rawUnit') {
        const conv = convertToSI(Number(next.rawValue), next.rawUnit)
        next.standardValue = conv.convertedValue ?? Number(next.rawValue)
        next.standardUnit = conv.toUnit
        next.validated = conv.valid
        next.validationMessage = conv.valid ? conv.message : conv.message
      }
      if (field === 'direction') {
        const dv = validateDirection(String(value))
        next.validated = dv.valid
        next.validationMessage = dv.message
      }
      return next
    })
    updateRecords(batchId, updated)
  }

  return (
    <div className="bg-[#16213e] rounded-lg border border-[#0f3460]/60">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-[#a8d8ea] hover:bg-[#0f3460]/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-semibold text-sm tracking-wide">📋 传感器记录</span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#a8d8ea]/70 border-b border-[#0f3460]/40">
                  <th className="py-2 px-2 text-left font-medium">参数名</th>
                  <th className="py-2 px-2 text-left font-medium">原始值</th>
                  <th className="py-2 px-2 text-left font-medium">单位</th>
                  <th className="py-2 px-2 text-left font-medium">标准值(SI)</th>
                  <th className="py-2 px-2 text-left font-medium">时间</th>
                  <th className="py-2 px-2 text-left font-medium">方向</th>
                  <th className="py-2 px-2 text-left font-medium">来源</th>
                  <th className="py-2 px-2 text-left font-medium">状态</th>
                  <th className="py-2 px-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.id} className="border-b border-[#0f3460]/20 hover:bg-[#0f3460]/20">
                    <td className="py-1.5 px-2">
                      <input
                        className="bg-[#1a1a2e] border border-[#0f3460]/50 rounded px-2 py-1 w-20 text-[#e2e8f0] focus:outline-none focus:border-[#a8d8ea]/50"
                        value={r.parameterName}
                        onChange={(e) => handleChange(i, 'parameterName', e.target.value)}
                        placeholder="参数名"
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        className="bg-[#1a1a2e] border border-[#0f3460]/50 rounded px-2 py-1 w-20 text-[#e2e8f0] font-mono focus:outline-none focus:border-[#a8d8ea]/50"
                        type="number"
                        value={r.rawValue}
                        onChange={(e) => handleChange(i, 'rawValue', Number(e.target.value))}
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <select
                        className="bg-[#1a1a2e] border border-[#0f3460]/50 rounded px-1 py-1 text-[#e2e8f0] focus:outline-none focus:border-[#a8d8ea]/50"
                        value={r.rawUnit}
                        onChange={(e) => handleChange(i, 'rawUnit', e.target.value)}
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={`${u.symbol}-${u.category}`} value={u.symbol}>
                            {u.symbol} ({u.name})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 px-2 font-mono text-[#16c79a]">
                      {r.standardValue ? r.standardValue.toExponential(3) : '-'}
                      <span className="text-[#a8d8ea]/50 ml-1">{r.standardUnit}</span>
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        className="bg-[#1a1a2e] border border-[#0f3460]/50 rounded px-2 py-1 w-36 text-[#e2e8f0] focus:outline-none focus:border-[#a8d8ea]/50"
                        type="datetime-local"
                        value={r.timestamp.slice(0, 16)}
                        onChange={(e) => handleChange(i, 'timestamp', e.target.value)}
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        className={`bg-[#1a1a2e] border rounded px-2 py-1 w-16 text-[#e2e8f0] focus:outline-none focus:border-[#a8d8ea]/50 ${!r.validated && r.validationMessage ? 'border-[#e94560]' : 'border-[#0f3460]/50'}`}
                        value={r.direction}
                        onChange={(e) => handleChange(i, 'direction', e.target.value)}
                        placeholder="方向"
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#0f3460]/40 text-[#a8d8ea]">{r.source}</span>
                    </td>
                    <td className="py-1.5 px-2">
                      {r.validated ? (
                        <CheckCircle size={14} className="text-[#16c79a]" />
                      ) : (
                        <span title={r.validationMessage}>
                          <AlertTriangle size={14} className="text-[#e94560]" />
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2">
                      <button
                        onClick={() => removeRecord(batchId, r.id)}
                        className="text-[#e94560]/60 hover:text-[#e94560] transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {records.some((r) => !r.validated && r.validationMessage) && (
            <div className="mt-2 space-y-1">
              {records.filter((r) => !r.validated && r.validationMessage).map((r) => (
                <div key={r.id} className="text-[11px] text-[#e94560] flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {r.parameterName || '未命名'}: {r.validationMessage}
                </div>
              ))}
            </div>
          )}
          {timeValidation.message && (
            <div
              className={`mt-2 text-[11px] flex items-center gap-1 px-2 py-1.5 rounded border ${
                timeValidation.valid
                  ? 'text-[#a8d8ea]/60 border-[#0f3460]/30 bg-[#0f3460]/20'
                  : 'text-[#f08c00] border-[#f08c00]/30 bg-[#f08c00]/10'
              }`}
            >
              <Clock size={12} className={timeValidation.valid ? 'text-[#a8d8ea]/50' : 'text-[#f08c00]'} />
              {timeValidation.message}
              {!timeValidation.valid && timeValidation.intervals.length > 0 && (
                <span className="ml-1 font-mono opacity-70">
                  (间隔: {timeValidation.intervals.map((s) => `${s}s`).join(', ')})
                </span>
              )}
            </div>
          )}
          <button
            onClick={handleAdd}
            className="mt-3 flex items-center gap-1 text-xs text-[#a8d8ea] hover:text-[#16c79a] transition-colors"
          >
            <Plus size={14} /> 添加记录
          </button>
        </div>
      )}
    </div>
  )
}
