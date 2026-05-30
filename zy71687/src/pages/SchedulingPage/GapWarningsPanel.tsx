import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { AlertTriangle, Clock, ShieldCheck } from 'lucide-react'
import Drawer from '@/components/shared/Drawer'
import DetailTable from '@/components/shared/DetailTable'
import { cn } from '@/lib/utils'
import type { GapWarning } from '@/data/types'

const sectionConfig = {
  uncovered: {
    title: '未覆盖金额',
    icon: AlertTriangle,
    iconColor: 'text-red-400',
    bgColor: 'bg-red-500/8',
    borderColor: 'border-red-500/15',
    dotColor: 'bg-red-400',
  },
  expiring_soon: {
    title: '即将到期',
    icon: Clock,
    iconColor: 'text-amber-400',
    bgColor: 'bg-amber-500/8',
    borderColor: 'border-amber-500/15',
    dotColor: 'bg-amber-400',
  },
  available_forward: {
    title: '可用锁汇',
    icon: ShieldCheck,
    iconColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/8',
    borderColor: 'border-emerald-500/15',
    dotColor: 'bg-emerald-400',
  },
} as const

type WarningType = keyof typeof sectionConfig

export default function GapWarningsPanel() {
  const { warnings, forwardContracts, settlementPlans } = useStore()
  const [selectedWarning, setSelectedWarning] = useState<GapWarning | null>(null)

  const grouped = {
    uncovered: warnings.filter((w) => w.type === 'uncovered'),
    expiring_soon: warnings.filter((w) => w.type === 'expiring_soon'),
    available_forward: warnings.filter((w) => w.type === 'available_forward'),
  }

  const relatedContracts = selectedWarning
    ? forwardContracts.filter((c) => selectedWarning.relatedIds.includes(c.id))
    : []

  const relatedPlans = selectedWarning
    ? settlementPlans.filter((p) => selectedWarning.relatedIds.some((id) => p.transactionId === id || p.forwardContractId === id))
    : []

  return (
    <>
      <div className="bg-[#1a1f2e] rounded-xl border border-white/5 overflow-hidden h-full flex flex-col">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white/90">缺口预警</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {(Object.keys(sectionConfig) as WarningType[]).map((type) => {
            const config = sectionConfig[type]
            const items = grouped[type]
            const Icon = config.icon

            return (
              <div key={type} className={cn('rounded-lg border p-3', config.bgColor, config.borderColor)}>
                <div className={cn('flex items-center gap-1.5 mb-2', config.iconColor)}>
                  <Icon size={12} />
                  <span className="text-[11px] font-semibold">{config.title}</span>
                  <span className="text-[10px] text-white/25 ml-auto">{items.length}</span>
                </div>

                {items.length === 0 && (
                  <div className="text-[10px] text-white/20 py-2">暂无预警</div>
                )}

                <div className="space-y-1.5">
                  {items.map((w) => (
                    <div
                      key={`${w.type}-${w.currency}-${w.amount}`}
                      onClick={() => setSelectedWarning(w)}
                      className="flex items-start gap-2 p-2 rounded-md bg-black/20 cursor-pointer hover:bg-black/30 transition-colors"
                    >
                      <div className={cn('w-1.5 h-1.5 rounded-full mt-1 shrink-0', config.dotColor)} />
                      <div className="min-w-0">
                        <div className="text-[11px] text-white/80 font-medium">
                          {w.currency} {w.amount.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-white/35 truncate">{w.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Drawer
        open={selectedWarning !== null}
        onClose={() => setSelectedWarning(null)}
        title="预警详情"
        width="w-80"
      >
        {selectedWarning && (
          <div className="space-y-4">
            <DetailTable
              rows={[
                { label: '类型', value: sectionConfig[selectedWarning.type as WarningType]?.title ?? selectedWarning.type },
                { label: '币种', value: selectedWarning.currency },
                { label: '金额', value: selectedWarning.amount.toLocaleString() },
                { label: '描述', value: selectedWarning.description },
              ]}
            />

            {relatedContracts.length > 0 && (
              <div>
                <h4 className="text-[11px] text-white/50 mb-2">关联锁汇合约</h4>
                {relatedContracts.map((c) => (
                  <div key={c.id} className="bg-[#0f1219] rounded-lg p-2.5 mb-1.5 text-[11px]">
                    <div className="text-white/70 font-medium">{c.id}</div>
                    <div className="text-white/35">{c.currency} {c.amount.toLocaleString()} @ {c.lockedRate}</div>
                  </div>
                ))}
              </div>
            )}

            {relatedPlans.length > 0 && (
              <div>
                <h4 className="text-[11px] text-white/50 mb-2">关联排程计划</h4>
                {relatedPlans.map((p) => (
                  <div key={p.id} className="bg-[#0f1219] rounded-lg p-2.5 mb-1.5 text-[11px]">
                    <div className="text-white/70 font-medium">{p.id}</div>
                    <div className="text-white/35">{p.currency} {p.amount.toLocaleString()} → ¥{p.settledAmountCNY.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}

            {relatedContracts.length === 0 && relatedPlans.length === 0 && (
              <div className="text-[10px] text-white/20">无直接关联记录</div>
            )}
          </div>
        )}
      </Drawer>
    </>
  )
}
