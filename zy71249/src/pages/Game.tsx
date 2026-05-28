import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { MATERIALS } from '@/data/gameConfig'
import {
  Ship, DollarSign, Unplug, Package, TrendingUp, AlertTriangle,
  ShoppingCart, Zap, ChevronRight, LogOut,
  ArrowRightLeft, Wallet,
} from 'lucide-react'
import type { EventType } from '@/types/game'

const BG = '#0D1B2A'
const CARD = '#1B2838'
const ACCENT = '#E85D04'
const TEXT = '#E0E1DD'
const BORDER = '#415A77'

const EVENT_CFG: Record<EventType, { icon: React.ReactNode; color: string }> = {
  PORT_CONGESTION: { icon: <Ship size={20} />, color: '#3B82F6' },
  EXCHANGE_RATE: { icon: <DollarSign size={20} />, color: '#10B981' },
  SUPPLIER_DISRUPTION: { icon: <Unplug size={20} />, color: '#EF4444' },
}

function invColor(qty: number, safe: number) {
  if (qty < safe * 0.5) return '#EF4444'
  if (qty < safe) return '#F59E0B'
  return '#10B981'
}

export default function Game() {
  const navigate = useNavigate()
  const {
    currentRound, maxRounds, cash, isFinished, isRoundActive,
    events, orders, inventory, suppliers, exchangeRate,
    selectedSupplierId, currentRoundActions, pendingShipments,
    advanceRound, endRound, doPurchase, doEmergencyPurchase, doDeliverOrder,
    doSwitchSupplier, finishGame,
  } = useGameStore()

  const [qty, setQty] = useState(100)
  const [emergMat, setEmergMat] = useState(MATERIALS[0].id)
  const [emergQty, setEmergQty] = useState(50)

  const roundEvents = events.filter(e => e.round === currentRound)
  const activeOrders = orders.filter(o => !o.isDelivered && !o.isExpired)
  const activeSuppliers = suppliers.filter(s => s.isActive)
  const selected = suppliers.find(s => s.id === selectedSupplierId)
  const matName = (id: string) => MATERIALS.find(m => m.id === id)?.name ?? id

  if (isFinished) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.85)' }}>
        <div className="rounded-xl p-8 max-w-md w-full text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <h2 className="text-3xl font-bold mb-4" style={{ color: ACCENT }}>游戏结束</h2>
          <p className="mb-2" style={{ color: TEXT }}>最终现金: ¥{cash.toLocaleString()}</p>
          <p className="mb-6" style={{ color: TEXT }}>总回合: {currentRound}/{maxRounds}</p>
          <button
            onClick={() => navigate('/report')}
            className="px-6 py-3 rounded-lg font-bold text-white"
            style={{ background: ACCENT }}
          >
            查看报告
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ background: BG, color: TEXT }}>
      {/* Left Sidebar */}
      <aside className="w-16 flex flex-col items-center py-6 gap-4 shrink-0" style={{ background: CARD, borderRight: `1px solid ${BORDER}` }}>
        <Package size={24} style={{ color: ACCENT }} />
        <TrendingUp size={20} />
        <Wallet size={20} />
        <div className="mt-auto">
          <LogOut size={20} className="opacity-50 cursor-pointer hover:opacity-100" onClick={() => finishGame()} />
        </div>
      </aside>

      {/* Center */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">回合 {currentRound}/{maxRounds}</h1>
          <div className="flex gap-3">
            {!isRoundActive && currentRound < maxRounds && (
              <button onClick={advanceRound} className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-white" style={{ background: ACCENT }}>
                {currentRound === 0 ? '开始游戏' : '推进下一回合'} <ChevronRight size={16} />
              </button>
            )}
            {isRoundActive && currentRound < maxRounds && (
              <button onClick={endRound} className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-white" style={{ background: BORDER }}>
                结束本回合 <ChevronRight size={16} />
              </button>
            )}
            {isRoundActive && currentRound >= maxRounds && (
              <button onClick={finishGame} className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold text-white bg-red-600">
                结束游戏
              </button>
            )}
          </div>
        </div>

        {/* Event panel */}
        {roundEvents.length > 0 && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roundEvents.map(e => {
              const cfg = EVENT_CFG[e.type]
              return (
                <div key={e.id} className="rounded-lg p-4 flex items-start gap-3" style={{ background: CARD, borderLeft: `4px solid ${cfg.color}` }}>
                  <div style={{ color: cfg.color }}>{cfg.icon}</div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: cfg.color }}>{e.type === 'PORT_CONGESTION' ? '港口拥堵' : e.type === 'EXCHANGE_RATE' ? '汇率波动' : '供应商中断'}</p>
                    <p className="text-xs mt-1 opacity-80">{e.description}</p>
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* Action panel */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Supplier & Purchase */}
          <div className="rounded-lg p-5 space-y-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <h3 className="font-bold flex items-center gap-2"><ShoppingCart size={18} style={{ color: ACCENT }} /> 供应商与采购</h3>
            <div className="grid grid-cols-2 gap-2">
              {activeSuppliers.map(s => (
                <button
                  key={s.id}
                  onClick={() => { const err = doSwitchSupplier(s.id); if (err) alert(err); }}
                  className={`text-left p-3 rounded-lg text-xs ${s.id === selectedSupplierId ? 'ring-2' : ''}`}
                  style={{ background: s.id === selectedSupplierId ? `${ACCENT}22` : '#0D1B2A', border: s.id === selectedSupplierId ? `2px solid ${ACCENT}` : `1px solid ${BORDER}` }}
                >
                  <p className="font-semibold">{s.name}</p>
                  <p className="opacity-70 mt-1">{matName(s.materialId)} · ¥{s.unitPrice}/{s.currency} · 交期{s.leadTime}回合 · 可靠{s.reliability}%</p>
                </button>
              ))}
            </div>
            {selected && isRoundActive && (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs opacity-60">采购数量 ({matName(selected.materialId)})</label>
                  <input type="range" min={10} max={1000} step={10} value={qty} onChange={e => setQty(+e.target.value)} className="w-full" />
                  <span className="text-sm font-bold">{qty}</span>
                </div>
                <button onClick={() => doPurchase(selected.id, qty)} className="px-4 py-2 rounded-lg font-bold text-white text-sm" style={{ background: ACCENT }}>采购</button>
              </div>
            )}
            {/* Emergency */}
            {isRoundActive && (
              <div className="pt-3 border-t" style={{ borderColor: BORDER }}>
                <h4 className="text-xs font-semibold flex items-center gap-1 mb-2"><Zap size={14} style={{ color: '#F59E0B' }} /> 紧急采购</h4>
                <div className="flex items-end gap-2">
                  <select value={emergMat} onChange={e => setEmergMat(e.target.value)} className="bg-transparent rounded px-2 py-1 text-xs flex-1" style={{ border: `1px solid ${BORDER}` }}>
                    {MATERIALS.map(m => <option key={m.id} value={m.id} style={{ background: CARD }}>{m.name}</option>)}
                  </select>
                  <input type="number" min={1} value={emergQty} onChange={e => setEmergQty(+e.target.value)} className="w-20 bg-transparent rounded px-2 py-1 text-xs" style={{ border: `1px solid ${BORDER}` }} />
                  <button onClick={() => doEmergencyPurchase(emergMat, emergQty)} className="px-3 py-1 rounded text-xs font-bold text-white" style={{ background: '#F59E0B' }}>紧急采购</button>
                </div>
              </div>
            )}
          </div>

          {/* Orders */}
          <div className="rounded-lg p-5 space-y-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <h3 className="font-bold flex items-center gap-2"><Package size={18} style={{ color: ACCENT }} /> 待交付订单</h3>
            {activeOrders.length === 0 && <p className="text-xs opacity-50">暂无待交付订单</p>}
            {activeOrders.map(o => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#0D1B2A', border: `1px solid ${BORDER}` }}>
                <div className="text-xs">
                  <span className="font-semibold">{o.id}</span>
                  <span className="opacity-70 ml-2">{matName(o.materialId)} × {o.quantity}</span>
                  <span className="ml-2">截止回合{o.deadline}</span>
                  <span className="ml-2" style={{ color: ACCENT }}>¥{o.unitPrice}/单位</span>
                </div>
                {isRoundActive && (
                  <button onClick={() => { const err = doDeliverOrder(o.id); if (err) alert(err); }} className="px-3 py-1 rounded text-xs font-bold text-white" style={{ background: '#10B981' }}>交付</button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Action log */}
        {currentRoundActions.length > 0 && (
          <section className="rounded-lg p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <h4 className="text-xs font-semibold mb-2 opacity-60">本回合操作记录</h4>
            <div className="space-y-1">
              {currentRoundActions.map((a, i) => (
                <p key={i} className="text-xs flex items-center gap-1"><ArrowRightLeft size={12} style={{ color: ACCENT }} /> {a}</p>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Right dashboard */}
      <aside className="w-72 shrink-0 p-4 space-y-4 overflow-y-auto hidden lg:block" style={{ background: CARD, borderLeft: `1px solid ${BORDER}` }}>
        {/* Cash */}
        <div className="rounded-lg p-4 text-center" style={{ background: BG, border: `1px solid ${BORDER}` }}>
          <p className="text-xs opacity-60 mb-1">现金余额</p>
          <p className="text-3xl font-bold" style={{ color: ACCENT }}>¥{cash.toLocaleString()}</p>
        </div>

        {/* Exchange rates */}
        <div className="rounded-lg p-4" style={{ background: BG, border: `1px solid ${BORDER}` }}>
          <p className="text-xs font-semibold mb-2 flex items-center gap-1"><DollarSign size={14} /> 汇率</p>
          <p className="text-sm">USD/CNY <span className="font-bold">{exchangeRate.USD_CNY.toFixed(2)}</span></p>
          <p className="text-sm">EUR/CNY <span className="font-bold">{exchangeRate.EUR_CNY.toFixed(2)}</span></p>
        </div>

        {/* Inventory */}
        <div className="rounded-lg p-4 space-y-3" style={{ background: BG, border: `1px solid ${BORDER}` }}>
          <p className="text-xs font-semibold mb-1">库存</p>
          {inventory.map(inv => {
            const mat = MATERIALS.find(m => m.id === inv.materialId)!
            const color = invColor(inv.quantity, mat.safetyStock)
            const pct = Math.min((inv.quantity / (mat.safetyStock * 2)) * 100, 100)
            return (
              <div key={inv.materialId}>
                <div className="flex justify-between text-xs">
                  <span>{mat.name}</span>
                  <span style={{ color }}>{inv.quantity}/{mat.safetyStock}</span>
                </div>
                <div className="h-2 rounded-full mt-1" style={{ background: '#0D1B2A' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Active supplier */}
        {selected && (
          <div className="rounded-lg p-4" style={{ background: BG, border: `1px solid ${BORDER}` }}>
            <p className="text-xs font-semibold mb-2">当前供应商</p>
            <p className="font-bold">{selected.name}</p>
            <p className="text-xs opacity-70 mt-1">{matName(selected.materialId)}</p>
            <p className="text-xs opacity-70">价格 ¥{selected.unitPrice} ({selected.currency}) · 交期 {selected.leadTime} 回合</p>
            <p className="text-xs opacity-70">可靠性 {selected.reliability}%</p>
            {!selected.isActive && <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#EF4444' }}><AlertTriangle size={12} /> 已中断</p>}
          </div>
        )}

        {/* Pending shipments */}
        {pendingShipments.length > 0 && (
          <div className="rounded-lg p-4" style={{ background: BG, border: `1px solid ${BORDER}` }}>
            <p className="text-xs font-semibold mb-2">在途货物</p>
            {pendingShipments.slice(-4).map(s => (
              <div key={s.id} className="text-xs py-1 border-b" style={{ borderColor: BORDER }}>
                <span>{matName(s.materialId)} × {s.quantity}</span>
                <span className="ml-2 opacity-60">到回合{s.arrivalRound}</span>
                {s.isDelayed && <span className="ml-1" style={{ color: '#EF4444' }}>延迟</span>}
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}
