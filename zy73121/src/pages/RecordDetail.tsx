import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  AlertTriangle,
  MessageSquare,
  CheckCircle,
  PauseCircle,
  RotateCcw,
  MapPin,
  Thermometer,
  Droplets,
  Waves,
  FlaskConical,
  Send,
} from 'lucide-react'
import { useAnomalyStore } from '@/hooks/useAnomalyStore'
import { detectCoordReversal } from '@/utils/coordCheck'
import { ANOMALY_TYPE_LABELS, STATUS_LABELS } from '@/utils/types'
import type { RecordStatus, AnomalyRecord, ShipRecord, Remark } from '@/utils/types'

const STATUS_BADGE: Record<RecordStatus, string> = {
  UNCONFIRMED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  CONFIRMED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  SUSPENDED: 'bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse',
  RESOLVED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase()
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-[#00E5A0]/20 text-[#00E5A0]',
    'bg-blue-500/20 text-blue-400',
    'bg-[#FF6B35]/20 text-[#FF6B35]',
    'bg-purple-500/20 text-purple-400',
    'bg-pink-500/20 text-pink-400',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function CoordWarning({ record }: { record: AnomalyRecord }) {
  const check = detectCoordReversal(record.sensorLat, record.sensorLng)
  const updateAnomalyStatus = useAnomalyStore((s) => s.updateAnomalyStatus)
  const addRemark = useAnomalyStore((s) => s.addRemark)
  if (!check.reversed) return null

  const handleSuspend = () => {
    if (window.confirm('确认将此记录标记为挂起待确认？经纬度疑似反写，需接手同事人工核实。')) {
      updateAnomalyStatus(record.id, 'SUSPENDED')
      addRemark(record.id, '系统', `经纬度疑似反写 - ${check.reason}`)
    }
  }

  return (
    <div className="bg-orange-500/15 border border-orange-500/30 rounded-xl p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-5 h-5 text-[#FF6B35]" />
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-[#FF6B35] mb-1">经纬度疑似反写</h4>
        <p className="text-sm text-orange-300/80">{check.reason}</p>
        <p className="text-xs text-slate-400 mt-2">
          当前值：纬度 {record.sensorLat.toFixed(4)}，经度 {record.sensorLng.toFixed(4)}
        </p>
      </div>
      {record.status !== 'SUSPENDED' && (
        <button
          onClick={handleSuspend}
          className="px-4 py-2 bg-[#FF6B35] hover:bg-[#e85f2c] text-white rounded-lg text-sm font-semibold transition-colors shrink-0"
        >
          挂起待确认
        </button>
      )}
    </div>
  )
}

function SensorDataCard({ record }: { record: AnomalyRecord }) {
  const fields = [
    { label: '采集时间', value: formatDate(record.sensorTimestamp), mono: true, icon: <Waves className="w-4 h-4" /> },
    { label: '纬度', value: record.sensorLat.toFixed(4), mono: true, icon: <MapPin className="w-4 h-4" /> },
    { label: '经度', value: record.sensorLng.toFixed(4), mono: true, icon: <MapPin className="w-4 h-4" /> },
    { label: '水温 (°C)', value: record.waterTemp.toFixed(1), mono: true, icon: <Thermometer className="w-4 h-4" /> },
    { label: '盐度 (PSU)', value: record.salinity.toFixed(1), mono: true, icon: <Droplets className="w-4 h-4" /> },
    { label: '溶解氧 (mg/L)', value: record.dissolvedOxygen.toFixed(1), mono: true, icon: <FlaskConical className="w-4 h-4" /> },
    { label: 'pH 值', value: record.phValue.toFixed(1), mono: true, icon: <FlaskConical className="w-4 h-4" /> },
  ]
  return (
    <div className="bg-[#1E293B] rounded-xl p-5 border border-slate-700/50">
      <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-700/50">
        <div className="w-8 h-8 rounded-lg bg-[#00E5A0]/10 flex items-center justify-center">
          <Waves className="w-4 h-4 text-[#00E5A0]" />
        </div>
        <h3 className="font-semibold text-slate-100">传感器数据</h3>
      </div>
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.label} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0 last:pb-0">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <span className="text-slate-500">{f.icon}</span>
              {f.label}
            </div>
            <span className={`text-slate-100 ${f.mono ? 'font-mono' : ''}`}>{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ShipDataCard({ shipRecords, anomalyTs }: { shipRecords: ShipRecord[]; anomalyTs: string }) {
  if (shipRecords.length === 0) {
    return (
      <div className="bg-[#1E293B] rounded-xl p-5 border border-slate-700/50 border-dashed">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-700/30 border-dashed">
          <div className="w-8 h-8 rounded-lg bg-slate-700/40 flex items-center justify-center">
            <Droplets className="w-4 h-4 text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-400">船上记录</h3>
        </div>
        <p className="text-sm text-slate-500 text-center py-8">暂无对应的船上人工记录</p>
      </div>
    )
  }

  const anomalyTime = new Date(anomalyTs).getTime()

  return (
    <div className="space-y-4">
      {shipRecords.map((ship) => {
        const diffMin = Math.round((new Date(ship.recordTimestamp).getTime() - anomalyTime) / 60000)
        const isSuspiciousDiff = Math.abs(diffMin) > 30

        return (
          <div key={ship.id} className="bg-[#1E293B] rounded-xl p-5 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700/50">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <Droplets className="w-4 h-4 text-blue-400" />
              </div>
              <h3 className="font-semibold text-slate-100">船上记录</h3>
              <div className="ml-auto flex items-center gap-2">
                {ship.isBoundarySample && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs font-medium">
                    边界样本
                  </span>
                )}
                {isSuspiciousDiff && (
                  <span className="px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-400 border border-orange-500/30 text-xs font-medium">
                    {diffMin > 0 ? `晚 ${diffMin} 分钟` : `早 ${Math.abs(diffMin)} 分钟`}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">记录时间</span>
                <span className={`font-mono text-slate-100 ${isSuspiciousDiff ? 'text-[#FF6B35]' : ''}`}>
                  {formatDate(ship.recordTimestamp)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">纬度</span>
                <span className="font-mono text-slate-100">{ship.recordLat.toFixed(4)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">经度</span>
                <span className="font-mono text-slate-100">{ship.recordLng.toFixed(4)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">水温</span>
                <span className="font-mono text-slate-100">{ship.waterTemp.toFixed(1)}°C</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">盐度</span>
                <span className="font-mono text-slate-100">{ship.salinity.toFixed(1)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">溶解氧</span>
                <span className="font-mono text-slate-100">{ship.dissolvedOxygen.toFixed(1)}</span>
              </div>
              <div className="flex justify-between py-1.5 col-span-2">
                <span className="text-slate-400">pH 值</span>
                <span className="font-mono text-slate-100">{ship.phValue.toFixed(1)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RemarkTimeline({ recordId }: { recordId: string }) {
  const remarks = useAnomalyStore((s) => s.getRemarksByRecordId(recordId))
  const addRemark = useAnomalyStore((s) => s.addRemark)
  const [content, setContent] = useState('')
  const [author, setAuthor] = useState('当前用户')

  const handleSubmit = () => {
    if (!content.trim()) return
    addRemark(recordId, author.trim() || '匿名', content.trim())
    setContent('')
  }

  return (
    <div className="bg-[#1E293B] rounded-xl p-5 border border-slate-700/50">
      <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-700/50">
        <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-blue-400" />
        </div>
        <h3 className="font-semibold text-slate-100">人工备注</h3>
        <span className="ml-auto text-xs text-slate-500">{remarks.length} 条</span>
      </div>

      {remarks.length > 0 ? (
        <div className="relative pl-7 before:content-[''] before:absolute before:left-3 before:top-1 before:bottom-8 before:w-0.5 before:bg-slate-700 mb-6">
          {remarks.map((r) => (
            <RemarkItem key={r.id} remark={r} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-6 mb-6">暂无备注记录</p>
      )}

      <div className="space-y-2 pt-3 border-t border-slate-700/50">
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="署名"
          className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#00E5A0]/60 transition"
        />
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
            }}
            placeholder="添加备注，Ctrl/⌘ + Enter 发送"
            rows={2}
            className="flex-1 bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#00E5A0]/60 transition resize-none"
          />
          <button
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="px-3 bg-[#00E5A0] hover:bg-[#00cc8e] disabled:bg-slate-700 disabled:text-slate-500 text-[#0A2540] rounded-lg transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function RemarkItem({ remark }: { remark: Remark }) {
  const cls = getAvatarColor(remark.author)
  return (
    <div className="relative mb-5 last:mb-0">
      <div className={`absolute -left-[22px] top-0 w-6 h-6 rounded-full ${cls} flex items-center justify-center text-xs font-semibold border-2 border-[#1E293B]`}>
        {getInitial(remark.author)}
      </div>
      <div className="bg-[#0F172A] rounded-lg p-3 border border-slate-800/80">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-semibold text-slate-200">{remark.author}</span>
          <span className="text-xs text-slate-500 font-mono">{formatDate(remark.createdAt)}</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{remark.content}</p>
      </div>
    </div>
  )
}

function StatusActions({ record }: { record: AnomalyRecord }) {
  const updateAnomalyStatus = useAnomalyStore((s) => s.updateAnomalyStatus)

  const actions: { label: string; status: RecordStatus; icon: React.ReactNode; style: string; confirm: string }[] = [
    {
      label: '确认异常',
      status: 'CONFIRMED',
      icon: <CheckCircle className="w-4 h-4" />,
      style: 'bg-emerald-600 hover:bg-emerald-500 text-white',
      confirm: '确认将此异常标记为已核实？',
    },
    {
      label: '挂起待确认',
      status: 'SUSPENDED',
      icon: <PauseCircle className="w-4 h-4" />,
      style: 'bg-[#FF6B35] hover:bg-[#e85f2c] text-white',
      confirm: '确认挂起？需接手同事人工核实。',
    },
    {
      label: '退回未确认',
      status: 'UNCONFIRMED',
      icon: <RotateCcw className="w-4 h-4" />,
      style: 'bg-slate-700 hover:bg-slate-600 text-slate-200',
      confirm: '确认将记录退回为未确认状态？',
    },
  ]

  return (
    <div className="bg-[#1E293B] rounded-xl p-5 border border-slate-700/50">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">当前状态：</span>
          <span className={`px-3 py-1 rounded-md border text-sm font-medium ${STATUS_BADGE[record.status]}`}>
            {STATUS_LABELS[record.status]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {actions.map((a) => (
            <button
              key={a.status}
              onClick={() => {
                if (window.confirm(a.confirm)) updateAnomalyStatus(record.id, a.status)
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${a.style}`}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const getAnomalyById = useAnomalyStore((s) => s.getAnomalyById)
  const getShipRecordsByAnomalyId = useAnomalyStore((s) => s.getShipRecordsByAnomalyId)

  const record = useMemo(() => (id ? getAnomalyById(id) : undefined), [id, getAnomalyById])
  const shipRecords = useMemo(
    () => (id ? getShipRecordsByAnomalyId(id) : []),
    [id, getShipRecordsByAnomalyId]
  )

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="w-16 h-16 text-slate-600 mb-4" />
        <p className="text-slate-400 text-lg mb-4">记录未找到</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-[#00E5A0] text-[#0A2540] font-semibold rounded-lg"
        >
          返回异常队列
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-6">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition"
      >
        <ArrowLeft className="w-4 h-4" />
        返回异常队列
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <span className="font-mono text-[#00E5A0]">{record.buoyId}</span>
            <span className="text-slate-300">·</span>
            <span className="text-lg text-slate-300 font-normal">{ANOMALY_TYPE_LABELS[record.anomalyType]}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            创建于 {formatDate(record.createdAt)} · 最近更新 {formatDate(record.updatedAt)}
          </p>
        </div>
      </div>

      <CoordWarning record={record} />
      <StatusActions record={record} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SensorDataCard record={record} />
            <ShipDataCard shipRecords={shipRecords} anomalyTs={record.sensorTimestamp} />
          </div>
        </div>
        <div className="lg:col-span-1">
          <RemarkTimeline recordId={record.id} />
        </div>
      </div>
    </div>
  )
}
