import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getReplayById } from '@/utils/reportExport'
import { MATERIALS } from '@/data/gameConfig'
import type { ReplayRecord, RoundSnapshot, EventType } from '@/types/game'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Ship, DollarSign,
  Unplug, Package, ArrowRightLeft,
} from 'lucide-react'

const BG = '#0D1B2A'
const CARD = '#1B2838'
const ACCENT = '#E85D04'
const TEXT = '#E0E1DD'
const BORDER = '#415A77'

const EVENT_ICONS: Record<EventType, { icon: React.ReactNode; color: string; label: string }> = {
  PORT_CONGESTION: { icon: <Ship size={18} />, color: '#3B82F6', label: '港口拥堵' },
  EXCHANGE_RATE: { icon: <DollarSign size={18} />, color: '#10B981', label: '汇率波动' },
  SUPPLIER_DISRUPTION: { icon: <Unplug size={18} />, color: '#EF4444', label: '供应商中断' },
}

export default function ReplayDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [replay, setReplay] = useState<ReplayRecord | null>(null)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (id) {
      const r = getReplayById(id)
      setReplay(r)
    }
  }, [id])

  if (!replay) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG, color: TEXT }}>
        <p>回放记录不存在</p>
      </div>
    )
  }

  const snapshot: RoundSnapshot | undefined = replay.rounds[step]
  const matName = (id: string) => MATERIALS.find(m => m.id === id)?.name ?? id

  return (
    <div className="min-h-screen" style={{ background: BG, color: TEXT }}>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/replay')} className="p-2 rounded-lg hover:opacity-80" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-xl font-bold">回放详情</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="p-2 rounded-lg disabled:opacity-30"
              style={{ background: CARD, border: `1px solid ${BORDER}` }}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-mono">
              {step + 1} / {replay.rounds.length}
            </span>
            <button
              onClick={() => setStep(Math.min(replay.rounds.length - 1, step + 1))}
              disabled={step === replay.rounds.length - 1}
              className="p-2 rounded-lg disabled:opacity-30"
              style={{ background: CARD, border: `1px solid ${BORDER}` }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg p-4 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-xs opacity-60 mb-1">最终得分</p>
            <p className="text-2xl font-bold" style={{ color: replay.netProfit >= 0 ? '#10B981' : '#EF4444' }}>
              {replay.netProfit >= 0 ? '+' : ''}¥{replay.netProfit.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg p-4 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-xs opacity-60 mb-1">总回合</p>
            <p className="text-2xl font-bold" style={{ color: ACCENT }}>{replay.rounds.length}</p>
          </div>
        </div>

        {snapshot && (
          <>
            <div className="rounded-lg p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <h3 className="font-bold mb-3">回合 {snapshot.round} 事件</h3>
              {snapshot.events.length === 0 ? (
                <p className="text-sm opacity-50">本回合无事件</p>
              ) : (
                <div className="space-y-2">
                  {snapshot.events.map(e => {
                    const cfg = EVENT_ICONS[e.type]
                    return (
                      <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: BG, borderLeft: `4px solid ${cfg.color}` }}>
                        <span style={{ color: cfg.color }}>{cfg.icon}</span>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: cfg.color }}>{cfg.label}</p>
                          <p className="text-xs opacity-70 mt-0.5">{e.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-lg p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <h3 className="font-bold mb-3 flex items-center gap-2"><ArrowRightLeft size={16} style={{ color: ACCENT }} /> 玩家操作</h3>
              {snapshot.actions.length === 0 ? (
                <p className="text-sm opacity-50">本回合无操作记录</p>
              ) : (
                <div className="space-y-1">
                  {snapshot.actions.map((a, i) => (
                    <p key={i} className="text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
                      {a}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <h3 className="font-bold mb-3">回合结束现金</h3>
                <p className="text-2xl font-bold font-mono" style={{ color: ACCENT }}>¥{snapshot.cashAfterRound.toLocaleString()}</p>
              </div>
              <div className="rounded-lg p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <h3 className="font-bold mb-3">库存快照</h3>
                <div className="space-y-2">
                  {Object.entries(snapshot.inventoryAfterRound).map(([matId, qty]) => {
                    const mat = MATERIALS.find(m => m.id === matId)
                    const safe = mat?.safetyStock || 0
                    const color = qty < safe * 0.5 ? '#EF4444' : qty < safe ? '#F59E0B' : '#10B981'
                    return (
                      <div key={matId} className="flex items-center justify-between text-sm">
                        <span>{matName(matId)}</span>
                        <span style={{ color }}>{qty} <span className="opacity-40">/ {safe}</span></span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-lg p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <h3 className="font-bold mb-3 flex items-center gap-2"><DollarSign size={16} /> 汇率快照</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="opacity-60">USD/CNY</span>
                  <p className="font-mono font-bold">{snapshot.exchangeRate.USD_CNY.toFixed(2)}</p>
                </div>
                <div>
                  <span className="opacity-60">EUR/CNY</span>
                  <p className="font-mono font-bold">{snapshot.exchangeRate.EUR_CNY.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
