import { useState } from 'react'
import { useStore } from '@/store/useStore'
import StatusBadge from '@/components/shared/StatusBadge'
import Drawer from '@/components/shared/Drawer'
import DetailTable from '@/components/shared/DetailTable'
import type { ForwardContract, SettlementPlan } from '@/data/types'

const statusVariantMap: Record<string, 'green' | 'blue' | 'red' | 'amber' | 'gray'> = {
  active: 'green',
  matched: 'blue',
  expired: 'gray',
  duplicate_error: 'red',
  rate_date_error: 'red',
}

const statusLabelMap: Record<string, string> = {
  active: '生效中',
  matched: '已匹配',
  expired: '已过期',
  duplicate_error: '重复错误',
  rate_date_error: '汇率日期错误',
}

const planStatusVariant: Record<string, 'green' | 'blue' | 'red' | 'amber' | 'gray'> = {
  planned: 'blue',
  executed: 'green',
  skipped_exception: 'red',
}

const planStatusLabel: Record<string, string> = {
  planned: '已排程',
  executed: '已执行',
  skipped_exception: '异常跳过',
}

interface DrawerState {
  type: 'contract' | 'plan'
  contract: ForwardContract | null
  plan: SettlementPlan | null
}

const initialDrawer: DrawerState = { type: 'contract', contract: null, plan: null }

export default function MatchingPanel() {
  const { forwardContracts, settlementPlans, isMatched } = useStore()
  const [drawer, setDrawer] = useState<DrawerState>(initialDrawer)

  const openContract = (c: ForwardContract) => setDrawer({ type: 'contract', contract: c, plan: null })
  const openPlan = (p: SettlementPlan) => setDrawer({ type: 'plan', contract: null, plan: p })
  const closeDrawer = () => setDrawer(initialDrawer)

  const isOpen = drawer.contract !== null || drawer.plan !== null

  return (
    <div className="bg-[#1a1f2e] rounded-xl border border-white/5 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white/90">锁汇合约匹配</h2>
      </div>

      <div className="p-4">
        <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
          {forwardContracts.map((c) => (
            <div
              key={c.id}
              onClick={() => openContract(c)}
              className="shrink-0 w-52 bg-[#0f1219] rounded-lg border border-white/5 p-3.5 cursor-pointer hover:border-white/15 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-white/60">{c.id}</span>
                <StatusBadge
                  label={statusLabelMap[c.status] ?? c.status}
                  variant={statusVariantMap[c.status] ?? 'gray'}
                />
              </div>
              <div className="text-sm font-semibold text-white/90">
                {c.currency} {c.amount.toLocaleString()}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 text-[11px]">
                <span className="text-white/35">锁汇汇率</span>
                <span className="text-white/80 text-right">{c.lockedRate}</span>
                <span className="text-white/35">到期日</span>
                <span className="text-white/80 text-right">{c.expiryDate}</span>
              </div>
            </div>
          ))}
          {forwardContracts.length === 0 && (
            <div className="text-white/25 text-xs py-6 w-full text-center">暂无锁汇合约</div>
          )}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-white/5 border-b border-white/5">
        <h3 className="text-xs font-semibold text-white/60">结汇排程计划</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/35 border-b border-white/5">
              <th className="text-left py-2.5 px-5 font-medium">计划ID</th>
              <th className="text-left py-2.5 px-3 font-medium">币种</th>
              <th className="text-right py-2.5 px-3 font-medium">金额</th>
              <th className="text-left py-2.5 px-3 font-medium">匹配合约</th>
              <th className="text-right py-2.5 px-3 font-medium">汇率</th>
              <th className="text-right py-2.5 px-3 font-medium">CNY金额</th>
              <th className="text-center py-2.5 px-3 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {settlementPlans.map((p) => (
              <tr
                key={p.id}
                onClick={() => openPlan(p)}
                className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
              >
                <td className="py-2.5 px-5 font-mono text-white/60">{p.id}</td>
                <td className="py-2.5 px-3 text-white/80">{p.currency}</td>
                <td className="py-2.5 px-3 text-right text-white/80">{p.amount.toLocaleString()}</td>
                <td className="py-2.5 px-3 text-white/50">{p.forwardContractId ?? '-'}</td>
                <td className="py-2.5 px-3 text-right text-white/80">{p.settledRate}</td>
                <td className="py-2.5 px-3 text-right text-white/90 font-medium">
                  ¥{p.settledAmountCNY.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <StatusBadge
                    label={planStatusLabel[p.status] ?? p.status}
                    variant={planStatusVariant[p.status] ?? 'gray'}
                  />
                </td>
              </tr>
            ))}
            {settlementPlans.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-white/25">
                  {isMatched ? '无排程计划' : '请先执行锁汇匹配'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Drawer
        open={isOpen}
        onClose={closeDrawer}
        title={drawer.type === 'contract' ? '锁汇合约详情' : '排程计划详情'}
      >
        {drawer.type === 'contract' && drawer.contract && (
          <DetailTable
            rows={[
              { label: '合约ID', value: drawer.contract.id },
              { label: '币种', value: drawer.contract.currency },
              { label: '金额', value: drawer.contract.amount.toLocaleString() },
              { label: '锁汇汇率', value: drawer.contract.lockedRate },
              { label: '签约日', value: drawer.contract.contractDate },
              { label: '到期日', value: drawer.contract.expiryDate },
              { label: '状态', value: statusLabelMap[drawer.contract.status] ?? drawer.contract.status },
              { label: '匹配订单', value: drawer.contract.matchedOrderId ?? '-' },
            ]}
          />
        )}
        {drawer.type === 'plan' && drawer.plan && (
          <DetailTable
            rows={[
              { label: '计划ID', value: drawer.plan.id },
              { label: '交易ID', value: drawer.plan.transactionId },
              { label: '锁汇合约', value: drawer.plan.forwardContractId ?? '无（即期）' },
              { label: '提现ID', value: drawer.plan.withdrawalId },
              { label: '币种', value: drawer.plan.currency },
              { label: '金额', value: drawer.plan.amount.toLocaleString() },
              { label: '结算汇率', value: drawer.plan.settledRate },
              { label: 'CNY金额', value: `¥${drawer.plan.settledAmountCNY.toLocaleString()}` },
              { label: '计划日期', value: drawer.plan.plannedDate },
              { label: '状态', value: planStatusLabel[drawer.plan.status] ?? drawer.plan.status },
              { label: '异常原因', value: drawer.plan.exceptionReason ?? '-' },
            ]}
          />
        )}
      </Drawer>
    </div>
  )
}
