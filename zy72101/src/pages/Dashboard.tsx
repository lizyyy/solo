import { useState, useCallback } from 'react'
import {
  Upload, Play, Trash2, AlertTriangle, CheckCircle2, XCircle,
  Waves, ArrowRightLeft, FlaskConical, Database,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea,
} from 'recharts'
import { useStore } from '@/store'
import { convertUnit, calculateStandingWaveModes, findGapIntervals, judgeRecord } from '@/utils/engine'
import type { SensorRecord, DiagnosisLevel, DiagnosisResult } from '@/types'

function LevelBadge({ level }: { level: DiagnosisLevel }) {
  const config = {
    safe: { cls: 'badge-safe', icon: CheckCircle2, text: '安全' },
    warn: { cls: 'badge-warn', icon: AlertTriangle, text: '确认' },
    danger: { cls: 'badge-danger', icon: XCircle, text: '危险' },
  }
  const c = config[level]
  return (
    <span className={`${c.cls} inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border`}>
      <c.icon className="w-3 h-3" />
      {c.text}
    </span>
  )
}

function DataImportCard() {
  const importLog = useStore(s => s.importLog)
  const loadSampleData = useStore(s => s.loadSampleData)
  const records = useStore(s => s.records)
  const clearRecords = useStore(s => s.clearRecords)
  const [text, setText] = useState('')

  const handleImport = useCallback(() => {
    if (text.trim()) {
      importLog(text)
      setText('')
    }
  }, [text, importLog])

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-gray-200">数据导入</h2>
        </div>
        {records.length > 0 && (
          <button onClick={clearRecords} className="btn-secondary text-xs px-2 py-1 flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> 清空
          </button>
        )}
      </div>
      <div className="card-body space-y-3">
        <textarea
          className="input-field w-full h-32 resize-none font-mono-data text-xs"
          placeholder="粘贴传感器日志（CSV 格式：timestamp, frequency, soundPressure, unit）"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div className="flex gap-2">
          <button onClick={handleImport} disabled={!text.trim()} className="btn-primary text-xs flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> 导入数据
          </button>
          <button onClick={loadSampleData} className="btn-secondary text-xs flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> 加载样例
          </button>
        </div>
      </div>
    </div>
  )
}

function ConversionTable({ records }: { records: SensorRecord[] }) {
  if (records.length === 0) return null
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-gray-200">单位换算</h2>
        </div>
      </div>
      <div className="card-body">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800/40">
                <th className="text-left py-2 px-2">时间</th>
                <th className="text-right py-2 px-2">频率</th>
                <th className="text-right py-2 px-2">原始值</th>
                <th className="text-center py-2 px-2">→</th>
                <th className="text-right py-2 px-2">dB SPL</th>
                <th className="text-right py-2 px-2">Pa</th>
              </tr>
            </thead>
            <tbody>
              {records.filter(r => !r.isEmpty).slice(0, 12).map(r => {
                const toDb = convertUnit(r.soundPressure, r.unit, 'dB')
                const toPa = convertUnit(r.soundPressure, r.unit, 'Pa')
                return (
                  <tr key={r.id} className={`border-b border-gray-800/20 ${r.isDuplicate ? 'bg-amber-500/5' : ''} ${r.isGap ? 'bg-red-500/5' : ''}`}>
                    <td className="py-1.5 px-2 font-mono-data text-gray-400">{r.timestamp.slice(11)}</td>
                    <td className="py-1.5 px-2 text-right font-mono-data">{r.frequency} Hz</td>
                    <td className="py-1.5 px-2 text-right font-mono-data">{r.soundPressure} {r.unit}</td>
                    <td className="py-1.5 px-2 text-center text-gray-600">→</td>
                    <td className="py-1.5 px-2 text-right font-mono-data">{isFinite(toDb.toValue) ? toDb.toValue.toFixed(1) : '—'}</td>
                    <td className="py-1.5 px-2 text-right font-mono-data">{toPa.toValue.toFixed(4)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function GapChart({ records }: { records: SensorRecord[] }) {
  const gaps = findGapIntervals(records)
  const validRecords = records.filter(r => !r.isEmpty)
  if (validRecords.length === 0) return null

  const chartData = validRecords.map(r => ({
    time: r.timestamp.slice(11, 19),
    frequency: r.frequency,
    pressure: r.unit === 'Pa' ? r.soundPressure : convertUnit(r.soundPressure, r.unit, 'Pa').toValue,
    isGap: r.isGap,
  }))

  const gapAreas = gaps.map((g, i) => {
    const startIdx = chartData.findIndex(d => d.time === g.start.slice(11, 19))
    const endIdx = chartData.findIndex(d => d.time === g.end.slice(11, 19))
    return { startIdx, endIdx, key: i }
  })

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <Waves className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-gray-200">时序与采样缺口</h2>
        </div>
        {gaps.length > 0 && (
          <span className="text-xs text-red-400">{gaps.length} 处缺口</span>
        )}
      </div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6B7280' }} />
            <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} label={{ value: 'Pa', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#6B7280' } }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111D32', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#9CA3AF' }}
            />
            {gapAreas.map(g => (
              g.startIdx >= 0 && g.endIdx >= 0 && (
                <ReferenceArea key={g.key} x1={chartData[g.startIdx]?.time} x2={chartData[g.endIdx]?.time} fill="rgba(239,68,68,0.08)" stroke="rgba(239,68,68,0.3)" strokeDasharray="4 4" />
              )
            ))}
            <Line type="monotone" dataKey="pressure" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B', r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
        {gaps.length > 0 && (
          <div className="mt-3 space-y-1">
            {gaps.map((g, i) => (
              <div key={i} className="text-xs text-red-400/80 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {g.start.slice(11)} → {g.end.slice(11)}（缺 {g.durationSeconds.toFixed(0)}s）
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StandingWaveCard() {
  const roomDimensions = useStore(s => s.roomDimensions)
  const setRoomDimensions = useStore(s => s.setRoomDimensions)
  const modes = calculateStandingWaveModes(roomDimensions)

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-gray-200">驻波模态计算</h2>
        </div>
        <span className="text-[10px] text-gray-500 font-mono-data">f = nc / 2L</span>
      </div>
      <div className="card-body space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {(['length', 'width', 'height'] as const).map(key => {
            const labels = { length: '长 L', width: '宽 W', height: '高 H' }
            return (
              <div key={key}>
                <label className="text-xs text-gray-500 mb-1 block">{labels[key]} (m)</label>
                <input
                  type="number"
                  className="input-field w-full font-mono-data text-xs"
                  value={roomDimensions[key]}
                  onChange={e => setRoomDimensions({ ...roomDimensions, [key]: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )
          })}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800/40">
                <th className="text-left py-1.5 px-2">阶次</th>
                <th className="text-left py-1.5 px-2">轴向</th>
                <th className="text-right py-1.5 px-2">频率 (Hz)</th>
              </tr>
            </thead>
            <tbody>
              {modes.slice(0, 12).map((m, i) => (
                <tr key={i} className="border-b border-gray-800/20">
                  <td className="py-1 px-2 font-mono-data text-gray-400">{m.order}</td>
                  <td className="py-1 px-2">
                    <span className={`inline-block w-5 h-5 rounded text-center text-[10px] leading-5 font-medium ${
                      m.axis === 'L' ? 'bg-blue-500/15 text-blue-400' :
                      m.axis === 'W' ? 'bg-purple-500/15 text-purple-400' :
                      'bg-teal-500/15 text-teal-400'
                    }`}>{m.axis}</span>
                  </td>
                  <td className="py-1 px-2 text-right font-mono-data text-amber-300">{m.frequency.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function DiagnosisResultsCard() {
  const records = useStore(s => s.records)
  const getCurrentThreshold = useStore(s => s.getCurrentThreshold)
  const runDiagnosis = useStore(s => s.runDiagnosis)
  const threshold = getCurrentThreshold()

  const results = records.map(r => judgeRecord(r, threshold))

  const summary = {
    safe: results.filter((r: DiagnosisResult) => r.level === 'safe').length,
    warn: results.filter((r: DiagnosisResult) => r.level === 'warn').length,
    danger: results.filter((r: DiagnosisResult) => r.level === 'danger').length,
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-gray-200">阈值判定</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500 font-mono-data">阈值 v{threshold.version}</span>
          <button onClick={runDiagnosis} className="btn-primary text-xs flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5" /> 运行诊断
          </button>
        </div>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-center">
            <div className="text-lg font-bold text-emerald-400 font-mono-data">{summary.safe}</div>
            <div className="text-[10px] text-emerald-400/70">安全</div>
          </div>
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-center">
            <div className="text-lg font-bold text-amber-400 font-mono-data">{summary.warn}</div>
            <div className="text-[10px] text-amber-400/70">需确认</div>
          </div>
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-center">
            <div className="text-lg font-bold text-red-400 font-mono-data">{summary.danger}</div>
            <div className="text-[10px] text-red-400/70">危险</div>
          </div>
        </div>
        <div className="space-y-2">
          {results.map((r: DiagnosisResult) => (
            <div
              key={r.id}
              className={`rounded-lg border-l-4 p-3 ${
                r.level === 'safe' ? 'bg-emerald-500/5 border-emerald-500' :
                r.level === 'warn' ? 'bg-amber-500/5 border-amber-500' :
                'bg-red-500/5 border-red-500'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <LevelBadge level={r.level} />
                  <span className="font-mono-data text-xs text-gray-300">{r.frequency} Hz</span>
                </div>
                <span className="font-mono-data text-xs text-gray-400">
                  {r.convertedValue.toFixed(2)} {r.convertedUnit}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">{r.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const records = useStore(s => s.records)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-100">诊断看板</h1>
        <p className="text-xs text-gray-500 mt-1">导入传感器日志 → 自动解析 → 单位换算 → 驻波计算 → 阈值判定</p>
      </div>

      <DataImportCard />

      {records.length > 0 && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <GapChart records={records} />
            <StandingWaveCard />
          </div>
          <ConversionTable records={records} />
          <DiagnosisResultsCard />
        </>
      )}
    </div>
  )
}
