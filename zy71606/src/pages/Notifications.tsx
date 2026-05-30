import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import StatusBadge from '@/components/StatusBadge'
import type { NotificationType, NotificationStatus, Notification } from '@/lib/api'
import {
  Search,
  Plus,
  Send,
  Save,
  RotateCcw,
  AlertTriangle,
  Filter,
  Clock,
} from 'lucide-react'

const TYPE_OPTIONS: { value: NotificationType | ''; label: string }[] = [
  { value: '', label: '全部类型' },
  { value: 'warning', label: '预警' },
  { value: 'margin_call', label: '追保' },
  { value: 'force_liquidation', label: '强平' },
]

const STATUS_OPTIONS: { value: NotificationStatus | ''; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'sent', label: '已发送' },
  { value: 'confirmed', label: '已确认' },
  { value: 'withdrawn', label: '已撤回' },
  { value: 'partially_deducted', label: '部分抵扣' },
  { value: 'settled', label: '已结清' },
]

function formatDate(t: string | null) {
  if (!t) return '--'
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function ComposeModal({
  onClose,
  onSend,
  onSave,
}: {
  onClose: () => void
  onSend: (data: { client_id: string; type: NotificationType; margin_shortfall: number; content: string }) => void
  onSave: (data: { client_id: string; type: NotificationType; margin_shortfall: number; content: string }) => void
}) {
  const [clientId, setClientId] = useState('')
  const [type, setType] = useState<NotificationType>('margin_call')
  const [shortfall, setShortfall] = useState(0)
  const [content, setContent] = useState('')
  const clients = useAppStore(s => s.clients.list)

  const data = { client_id: clientId, type, margin_shortfall: shortfall, content }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-card border border-border rounded-lg w-full max-w-lg p-6 shadow-xl">
        <h3 className="font-heading font-semibold text-text-primary mb-4">新建通知</h3>
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
            <label className="block text-sm text-text-secondary mb-1">类型</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as NotificationType)}
              className="w-full bg-bg-secondary border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="warning">预警</option>
              <option value="margin_call">追保</option>
              <option value="force_liquidation">强平</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">保证金缺口</label>
            <input
              type="number"
              value={shortfall}
              onChange={e => setShortfall(Number(e.target.value))}
              className="w-full bg-bg-secondary border border-border rounded-md px-3 py-2 text-sm text-text-primary font-mono-num focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">通知内容</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={4}
              className="w-full bg-bg-secondary border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm border border-border text-text-secondary hover:bg-bg-secondary transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onSave(data)}
            className="px-4 py-2 rounded-md text-sm border border-accent text-accent hover:bg-accent/10 transition-colors"
          >
            <span className="flex items-center gap-1.5"><Save size={14} /> 保存草稿</span>
          </button>
          <button
            onClick={() => onSend(data)}
            className="px-4 py-2 rounded-md text-sm bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            <span className="flex items-center gap-1.5"><Send size={14} /> 发送</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function WithdrawModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-card border border-border rounded-lg w-full max-w-md p-6 shadow-xl">
        <h3 className="font-heading font-semibold text-text-primary mb-4">撤回通知</h3>
        <div>
          <label className="block text-sm text-text-secondary mb-1">撤回原因</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            className="w-full bg-bg-secondary border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onCancel} className="px-4 py-2 rounded-md text-sm border border-border text-text-secondary hover:bg-bg-secondary transition-colors">取消</button>
          <button onClick={() => onConfirm(reason)} disabled={!reason} className="px-4 py-2 rounded-md text-sm bg-force-liq text-white hover:bg-force-liq/90 transition-colors disabled:opacity-50">确认撤回</button>
        </div>
      </div>
    </div>
  )
}

export default function Notifications() {
  const { list, filters, loading, duplicateWarning } = useAppStore(s => s.notifications)
  const fetchNotifications = useAppStore(s => s.fetchNotifications)
  const setNotificationFilters = useAppStore(s => s.setNotificationFilters)
  const createNotification = useAppStore(s => s.createNotification)
  const sendNotification = useAppStore(s => s.sendNotification)
  const withdrawNotificationAction = useAppStore(s => s.withdrawNotification)
  const checkDuplicate = useAppStore(s => s.checkDuplicate)
  const clearDuplicateWarning = useAppStore(s => s.clearDuplicateWarning)
  const fetchClients = useAppStore(s => s.fetchClients)
  const showConfirmModal = useAppStore(s => s.showConfirmModal)

  const [showCompose, setShowCompose] = useState(false)
  const [withdrawTarget, setWithdrawTarget] = useState<Notification | null>(null)
  const [activeTab, setActiveTab] = useState<'list' | 'history'>('list')
  const [statusLogs, setStatusLogs] = useState<{ from_status: string; to_status: string; reason: string | null; created_at: string }[]>([])

  useEffect(() => {
    fetchNotifications()
    fetchClients()
  }, [fetchNotifications, fetchClients, filters])

  const handleSend = async (data: { client_id: string; type: NotificationType; margin_shortfall: number; content: string }) => {
    const today = new Date().toISOString().slice(0, 10)
    await checkDuplicate(data.client_id, data.type, today)
    const dup = useAppStore.getState().notifications.duplicateWarning
    if (dup) return
    const n = await createNotification(data)
    await sendNotification(n.id)
    setShowCompose(false)
    fetchNotifications()
  }

  const handleSave = async (data: { client_id: string; type: NotificationType; margin_shortfall: number; content: string }) => {
    await createNotification(data)
    setShowCompose(false)
    fetchNotifications()
  }

  const handleWithdraw = async (reason: string) => {
    if (!withdrawTarget) return
    await withdrawNotificationAction(withdrawTarget.id, reason)
    setWithdrawTarget(null)
    fetchNotifications()
  }

  const handleViewHistory = async (n: Notification) => {
    setActiveTab('history')
    try {
      const res = await fetch(`/api/notifications/${n.id}/logs`)
      const logs = await res.json()
      setStatusLogs(logs)
    } catch {
      setStatusLogs([])
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="搜索客户"
            value={filters.client_id}
            onChange={e => setNotificationFilters({ client_id: e.target.value, page: 1 })}
            className="w-full bg-bg-card border border-border rounded-md pl-9 pr-4 py-1.5 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
          />
        </div>
        <select
          value={filters.type}
          onChange={e => setNotificationFilters({ type: e.target.value as NotificationType | '', page: 1 })}
          className="bg-bg-card border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={filters.status}
          onChange={e => setNotificationFilters({ status: e.target.value as NotificationStatus | '', page: 1 })}
          className="bg-bg-card border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input
          type="date"
          value={filters.start_date}
          onChange={e => setNotificationFilters({ start_date: e.target.value, page: 1 })}
          className="bg-bg-card border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
        />
        <input
          type="date"
          value={filters.end_date}
          onChange={e => setNotificationFilters({ end_date: e.target.value, page: 1 })}
          className="bg-bg-card border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
        />
        <button
          onClick={() => setShowCompose(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          <Plus size={14} /> 新建通知
        </button>
      </div>

      {duplicateWarning && (
        <div className="flex items-center gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
          <AlertTriangle size={16} className="text-warning shrink-0" />
          <span className="text-sm text-warning">
            该客户今日已发送过相同类型通知（{formatDate(duplicateWarning.sent_at)} 发送）
          </span>
          <button onClick={clearDuplicateWarning} className="ml-auto text-warning text-sm hover:underline">关闭</button>
        </div>
      )}

      <div className="flex gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'list' ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary'}`}
        >
          通知列表
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'history' ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:text-text-primary'}`}
        >
          状态历史
        </button>
      </div>

      {activeTab === 'list' ? (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-text-secondary text-sm">加载中...</div>
          ) : list.length === 0 ? (
            <div className="text-center py-8 text-text-secondary text-sm">暂无通知</div>
          ) : (
            list.map(n => (
              <div
                key={n.id}
                className="flex gap-4 bg-bg-card border border-border rounded-lg p-4 hover:border-accent/30 transition-colors"
              >
                <div className="w-px bg-border shrink-0" />
                <div className="w-20 shrink-0">
                  <div className="text-xs text-text-secondary">{formatDate(n.created_at).slice(0, 10)}</div>
                  <div className="text-xs text-text-secondary">{formatDate(n.created_at).slice(11)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-text-primary">{n.client?.name || '--'}</span>
                    <StatusBadge type="notification" value={n.status} />
                    <StatusBadge type="risk" value={n.type === 'warning' ? 'warning' : n.type === 'margin_call' ? 'margin_call' : 'force_liquidation'} />
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2">{n.content || '--'}</p>
                  <div className="mt-1 font-mono-num text-sm text-accent">
                    缺口: ¥{n.margin_shortfall.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {n.status === 'sent' && (
                    <button
                      onClick={() => setWithdrawTarget(n)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-warning hover:bg-warning/10 rounded transition-colors"
                    >
                      <RotateCcw size={12} /> 撤回
                    </button>
                  )}
                  <button
                    onClick={() => handleViewHistory(n)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:bg-bg-secondary rounded transition-colors"
                  >
                    <Clock size={12} /> 历史
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-bg-card border border-border rounded-lg p-4">
          {statusLogs.length === 0 ? (
            <div className="text-center py-8 text-text-secondary text-sm">选择通知查看状态历史</div>
          ) : (
            <div className="space-y-3">
              {statusLogs.map((log, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-text-secondary w-32 shrink-0">{formatDate(log.created_at)}</span>
                  <StatusBadge type="notification" value={log.from_status as NotificationStatus} />
                  <span className="text-text-secondary">→</span>
                  <StatusBadge type="notification" value={log.to_status as NotificationStatus} />
                  {log.reason && <span className="text-text-secondary text-xs">原因: {log.reason}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCompose && (
        <ComposeModal onClose={() => setShowCompose(false)} onSend={handleSend} onSave={handleSave} />
      )}
      {withdrawTarget && (
        <WithdrawModal onConfirm={handleWithdraw} onCancel={() => setWithdrawTarget(null)} />
      )}
    </div>
  )
}
