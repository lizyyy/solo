import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import StatusBadge from '@/components/StatusBadge'
import type { MatchStatus, Notification } from '@/lib/api'
import { Search, Plus, Zap, Link } from 'lucide-react'

function formatDate(t: string | null) {
  if (!t) return '--'
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function CreateDepositModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: (data: { client_id: string; amount: number; deposit_time: string }) => void
}) {
  const clients = useAppStore(s => s.clients.list)
  const [clientId, setClientId] = useState('')
  const [amount, setAmount] = useState(0)
  const [time, setTime] = useState(new Date().toISOString().slice(0, 16))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-card border border-border rounded-lg w-full max-w-md p-6 shadow-xl">
        <h3 className="font-heading font-semibold text-text-primary mb-4">录入入金</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">客户</label>
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-full bg-bg-secondary border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">选择客户</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.account})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">金额</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full bg-bg-secondary border border-border rounded-md px-3 py-2 text-sm text-text-primary font-mono-num focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">入金时间</label>
            <input
              type="datetime-local"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full bg-bg-secondary border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm border border-border text-text-secondary hover:bg-bg-secondary transition-colors">取消</button>
          <button
            onClick={() => onConfirm({ client_id: clientId, amount, deposit_time: time })}
            disabled={!clientId || amount <= 0}
            className="px-4 py-2 rounded-md text-sm bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            确认录入
          </button>
        </div>
      </div>
    </div>
  )
}

function ManualMatchModal({
  depositId,
  onClose,
  onConfirm,
}: {
  depositId: string
  onClose: () => void
  onConfirm: (depositId: string, notificationId: string, amount: number) => void
}) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [selected, setSelected] = useState('')
  const [amount, setAmount] = useState(0)

  useEffect(() => {
    fetch('/api/notifications?status=sent')
      .then(r => r.json())
      .then(res => {
        const items = res.data?.data || res.data || []
        setNotifications(Array.isArray(items) ? items : [])
      })
      .catch(() => {})
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-card border border-border rounded-lg w-full max-w-md p-6 shadow-xl">
        <h3 className="font-heading font-semibold text-text-primary mb-4">手动匹配</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">选择通知</label>
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="w-full bg-bg-secondary border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="">选择催缴通知</option>
              {notifications.map(n => (
                <option key={n.id} value={n.id}>
                  {n.client?.name || n.client_id} - ¥{n.margin_shortfall.toLocaleString('zh-CN')} - {n.type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">匹配金额</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full bg-bg-secondary border border-border rounded-md px-3 py-2 text-sm text-text-primary font-mono-num focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm border border-border text-text-secondary hover:bg-bg-secondary transition-colors">取消</button>
          <button
            onClick={() => onConfirm(depositId, selected, amount)}
            disabled={!selected || amount <= 0}
            className="px-4 py-2 rounded-md text-sm bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            确认匹配
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Deposits() {
  const { list, filters, loading, selected } = useAppStore(s => s.deposits)
  const fetchDeposits = useAppStore(s => s.fetchDeposits)
  const setDepositFilters = useAppStore(s => s.setDepositFilters)
  const createDeposit = useAppStore(s => s.createDeposit)
  const triggerAutoMatch = useAppStore(s => s.triggerAutoMatch)
  const manualMatch = useAppStore(s => s.manualMatch)
  const selectDeposit = useAppStore(s => s.selectDeposit)
  const fetchClients = useAppStore(s => s.fetchClients)
  const showConfirmModal = useAppStore(s => s.showConfirmModal)

  const [showCreate, setShowCreate] = useState(false)
  const [matchTarget, setMatchTarget] = useState<string | null>(null)

  useEffect(() => {
    fetchDeposits()
    fetchClients()
  }, [fetchDeposits, fetchClients, filters])

  const handleCreate = async (data: { client_id: string; amount: number; deposit_time: string }) => {
    await createDeposit(data)
    setShowCreate(false)
    fetchDeposits()
  }

  const handleAutoMatch = () => {
    showConfirmModal('自动匹配', '确认触发入金自动匹配？', async () => {
      await triggerAutoMatch()
    })
  }

  const handleManualMatch = async (depositId: string, notificationId: string, amount: number) => {
    await manualMatch(depositId, notificationId, amount)
    setMatchTarget(null)
  }

  const unmatchedHints: Record<string, string> = {
    unmatched: '客户无未结清通知或金额/时间不匹配',
    partially_matched: '部分金额已匹配，剩余金额未关联通知',
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="搜索客户"
              value={filters.client_id}
              onChange={e => setDepositFilters({ client_id: e.target.value, page: 1 })}
              className="w-full bg-bg-card border border-border rounded-md pl-9 pr-4 py-1.5 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
            />
          </div>
          <select
            value={filters.match_status}
            onChange={e => setDepositFilters({ match_status: e.target.value as MatchStatus | '', page: 1 })}
            className="bg-bg-card border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="">全部状态</option>
            <option value="unmatched">未匹配</option>
            <option value="partially_matched">部分匹配</option>
            <option value="matched">已匹配</option>
          </select>
          <input
            type="date"
            value={filters.start_date}
            onChange={e => setDepositFilters({ start_date: e.target.value })}
            className="bg-bg-card border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
          <input
            type="date"
            value={filters.end_date}
            onChange={e => setDepositFilters({ end_date: e.target.value })}
            className="bg-bg-card border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleAutoMatch}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border border-accent text-accent hover:bg-accent/10 transition-colors"
          >
            <Zap size={14} /> 自动匹配
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            <Plus size={14} /> 录入入金
          </button>
        </div>

        <div className="bg-bg-card border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="text-left px-4 py-3 font-medium">客户</th>
                <th className="text-right px-4 py-3 font-medium">金额</th>
                <th className="text-left px-4 py-3 font-medium">入金时间</th>
                <th className="text-left px-4 py-3 font-medium">匹配状态</th>
                <th className="text-left px-4 py-3 font-medium">关联通知</th>
                <th className="text-left px-4 py-3 font-medium">来源</th>
                <th className="text-left px-4 py-3 font-medium">可能原因</th>
                <th className="text-left px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-text-secondary">加载中...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-text-secondary">暂无数据</td></tr>
              ) : (
                list.map(d => (
                  <tr
                    key={d.id}
                    onClick={() => selectDeposit(d)}
                    className={`border-b border-border/50 hover:bg-bg-secondary/50 transition-colors cursor-pointer ${
                      d.match_status === 'unmatched' ? 'border-l-2 border-l-margin-call' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-text-primary">{d.client?.name || '--'}</td>
                    <td className="px-4 py-3 font-mono-num text-right text-text-primary">
                      ¥{d.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(d.deposit_time)}</td>
                    <td className="px-4 py-3"><StatusBadge type="match" value={d.match_status} /></td>
                    <td className="px-4 py-3 text-text-secondary text-xs">--</td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {d.source_file || '--'}{d.source_line ? `:${d.source_line}` : ''}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {d.match_status !== 'matched' ? (unmatchedHints[d.match_status] || '--') : '--'}
                    </td>
                    <td className="px-4 py-3">
                      {d.match_status !== 'matched' && (
                        <button
                          onClick={e => { e.stopPropagation(); setMatchTarget(d.id) }}
                          className="flex items-center gap-1 text-xs text-accent hover:bg-accent/10 px-2 py-1 rounded transition-colors"
                        >
                          <Link size={12} /> 匹配
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="w-72 bg-bg-card border border-border rounded-lg p-4 shrink-0">
          <h3 className="font-heading font-semibold text-text-primary mb-3">入金详情</h3>
          <div className="space-y-3 text-sm">
            <div><span className="text-text-secondary">客户:</span> <span className="text-text-primary">{selected.client?.name || '--'}</span></div>
            <div><span className="text-text-secondary">金额:</span> <span className="font-mono-num text-text-primary">¥{selected.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span></div>
            <div><span className="text-text-secondary">时间:</span> <span className="text-text-primary">{formatDate(selected.deposit_time)}</span></div>
            <div><span className="text-text-secondary">状态:</span> <StatusBadge type="match" value={selected.match_status} /></div>
            <div><span className="text-text-secondary">来源:</span> <span className="text-text-primary text-xs">{selected.source_file || '--'}{selected.source_line ? `:${selected.source_line}` : ''}</span></div>
          </div>
        </div>
      )}

      {showCreate && <CreateDepositModal onClose={() => setShowCreate(false)} onConfirm={handleCreate} />}
      {matchTarget && (
        <ManualMatchModal
          depositId={matchTarget}
          onClose={() => setMatchTarget(null)}
          onConfirm={handleManualMatch}
        />
      )}
    </div>
  )
}
