import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  User,
  ChevronDown,
  Send,
  CheckCircle2,
  Zap,
} from 'lucide-react'
import { api } from '@/services/api'
import type { Issue, IssueLog } from '../../shared/types'

type IssueType = Issue['type']
type IssueStatus = Issue['status']

import {
  getIssueTypeLabel,
  getIssueTypeColor,
  getIssueSeverityLabel,
  getIssueSeverityColor,
  getIssueStatusLabel,
  getIssueStatusColor,
  getActionLabel,
  getActionIcon,
  getActionColor,
  formatDateTime,
} from '@/components/StatusBadges'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/app'

const COLUMNS: { status: IssueStatus; title: string; color: string }[] = [
  { status: 'open', title: '待修正', color: 'border-status-warning' },
  { status: 'fixing', title: '修正中', color: 'border-status-info' },
  { status: 'confirmed', title: '已确认', color: 'border-status-success' },
]

export default function IssuesPage() {
  const navigate = useNavigate()
  const { currentUser } = useStore()
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [issueLogs, setIssueLogs] = useState<IssueLog[]>([])
  const [typeFilter, setTypeFilter] = useState<IssueType | 'all'>('all')
  const [severityFilter, setSeverityFilter] = useState<Issue['severity'] | 'all'>('all')
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const [severityDropdownOpen, setSeverityDropdownOpen] = useState(false)
  const [fixPlan, setFixPlan] = useState('')
  const [confirmComment, setConfirmComment] = useState('')
  const [autoDetecting, setAutoDetecting] = useState(false)

  useEffect(() => {
    loadIssues()
  }, [typeFilter, severityFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedIssue) {
      loadIssueLogs(selectedIssue.id)
    }
  }, [selectedIssue])

  async function loadIssues() {
    setLoading(true)
    try {
      const filters: { type?: IssueType; severity?: Issue['severity'] } = {}
      if (typeFilter !== 'all') filters.type = typeFilter
      if (severityFilter !== 'all') filters.severity = severityFilter
      const data = await api.issues.list(filters)
      setIssues(data)
    } finally {
      setLoading(false)
    }
  }

  async function loadIssueLogs(issueId: string) {
    const logs = await api.issues.logs(issueId)
    setIssueLogs(logs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
  }

  async function handleAutoDetect() {
    setAutoDetecting(true)
    try {
      const newIssues = await api.issues.autoDetect()
      setIssues(prev => [...prev, ...newIssues])
    } finally {
      setAutoDetecting(false)
    }
  }

  async function handleSubmitFix() {
    if (!selectedIssue || !fixPlan.trim()) return
    try {
      await api.issues.submitFix(selectedIssue.id, {
        fixPlan: fixPlan.trim(),
        fixedBy: currentUser,
      })
      setFixPlan('')
      await Promise.all([loadIssues(), loadIssueLogs(selectedIssue.id)])
      const updated = await api.issues.get(selectedIssue.id)
      setSelectedIssue(updated)
    } catch (e) {
      alert('提交失败')
    }
  }

  async function handleConfirmFix() {
    if (!selectedIssue) return
    try {
      await api.issues.confirmFix(selectedIssue.id, {
        confirmedBy: currentUser,
        comment: confirmComment.trim() || undefined,
      })
      setConfirmComment('')
      await Promise.all([loadIssues(), loadIssueLogs(selectedIssue.id)])
      const updated = await api.issues.get(selectedIssue.id)
      setSelectedIssue(updated)
    } catch {
      alert('确认失败')
    }
  }

  function getIssuesByStatus(status: IssueStatus) {
    return issues.filter(i => i.status === status)
  }

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-100">问题追踪</h2>
          <p className="text-sm text-gray-400 mt-1">管理和修复提示词库中的质量问题</p>
        </div>
        <div className="flex items-center gap-3">
          <FilterDropdown
            label="问题类型"
            value={typeFilter}
            options={[
              { value: 'all', label: '全部类型' },
              { value: 'duplicate', label: getIssueTypeLabel('duplicate') },
              { value: 'rating_inconsistency', label: getIssueTypeLabel('rating_inconsistency') },
              { value: 'deprecated_usage', label: getIssueTypeLabel('deprecated_usage') },
            ]}
            onChange={v => setTypeFilter(v as IssueType | 'all')}
            isOpen={typeDropdownOpen}
            onToggle={() => setTypeDropdownOpen(!typeDropdownOpen)}
          />
          <FilterDropdown
            label="严重程度"
            value={severityFilter}
            options={[
              { value: 'all', label: '全部程度' },
              { value: 'low', label: getIssueSeverityLabel('low') },
              { value: 'medium', label: getIssueSeverityLabel('medium') },
              { value: 'high', label: getIssueSeverityLabel('high') },
            ]}
            onChange={v => setSeverityFilter(v as Issue['severity'] | 'all')}
            isOpen={severityDropdownOpen}
            onToggle={() => setSeverityDropdownOpen(!severityDropdownOpen)}
          />
          <button onClick={handleAutoDetect} disabled={autoDetecting} className="btn-primary">
            {autoDetecting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            自动检测
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-3 gap-4">
        {COLUMNS.map(column => (
          <KanbanColumn
            key={column.status}
            column={column}
            issues={getIssuesByStatus(column.status)}
            loading={loading}
            onSelect={setSelectedIssue}
          />
        ))}
      </div>

      {selectedIssue && (
        <IssueDetailPanel
          issue={selectedIssue}
          logs={issueLogs}
          fixPlan={fixPlan}
          setFixPlan={setFixPlan}
          confirmComment={confirmComment}
          setConfirmComment={setConfirmComment}
          onClose={() => setSelectedIssue(null)}
          onSubmitFix={handleSubmitFix}
          onConfirmFix={handleConfirmFix}
          onNavigatePrompt={(id) => navigate(`/archive/${id}`)}
        />
      )}
    </div>
  )
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
  isOpen,
  onToggle,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  isOpen: boolean
  onToggle: () => void
}) {
  const selected = options.find(o => o.value === value)
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="btn-secondary px-3 py-2"
      >
        {selected?.label || label}
        <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-bg-card border border-bg-border rounded-md shadow-lg z-20 min-w-[150px] overflow-auto animate-fade-in">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); onToggle() }}
              className={cn(
                'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-bg-hover',
                value === opt.value && 'bg-brand-amber/10 text-brand-amber'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function KanbanColumn({
  column,
  issues,
  loading,
  onSelect,
}: {
  column: { status: IssueStatus; title: string; color: string }
  issues: Issue[]
  loading: boolean
  onSelect: (issue: Issue) => void
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div className={cn('flex items-center justify-between px-4 py-3 border-t-2 rounded-t-lg bg-bg-card border-x border-bg-border', column.color)}>
        <div className="flex items-center gap-2">
          <span className={cn('badge', getIssueStatusColor(column.status))}>
            {column.title}
          </span>
          <span className="text-sm text-gray-400">{issues.length}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-bg-card/50 border-x border-b border-bg-border rounded-b-lg p-3 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-amber border-t-transparent" />
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            暂无问题
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((issue, index) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                index={index}
                onClick={() => onSelect(issue)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function IssueCard({
  issue,
  index,
  onClick,
}: {
  issue: Issue
  index: number
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="card p-4 cursor-pointer hover:border-brand-amber/30 transition-colors"
      style={{ animation: `fade-in 0.2s ease-out ${index * 0.03}s both` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`badge border ${getIssueTypeColor(issue.type)}`}>
          {getIssueTypeLabel(issue.type)}
        </span>
        <span className={`badge border ${getIssueSeverityColor(issue.severity)}`}>
          {getIssueSeverityLabel(issue.severity)}
        </span>
      </div>
      <p className="text-sm text-gray-300 mb-3 line-clamp-2">{issue.description}</p>
      {issue.relatedPrompts && issue.relatedPrompts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {issue.relatedPrompts.slice(0, 2).map(p => (
            <span
              key={p.id}
              className="chip bg-bg-lighter text-gray-400 border-bg-border border text-xs"
            >
              {p.title}
            </span>
          ))}
          {issue.relatedPrompts.length > 2 && (
            <span className="chip bg-bg-lighter text-gray-500 border-bg-border border text-xs">
              +{issue.relatedPrompts.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function IssueDetailPanel({
  issue,
  logs,
  fixPlan,
  setFixPlan,
  confirmComment,
  setConfirmComment,
  onClose,
  onSubmitFix,
  onConfirmFix,
  onNavigatePrompt,
}: {
  issue: Issue
  logs: IssueLog[]
  fixPlan: string
  setFixPlan: (v: string) => void
  confirmComment: string
  setConfirmComment: (v: string) => void
  onClose: () => void
  onSubmitFix: () => void
  onConfirmFix: () => void
  onNavigatePrompt: (id: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-bg-card border-l border-bg-border flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-bg-border">
          <div className="flex items-center gap-2">
            <span className={`badge border ${getIssueTypeColor(issue.type)}`}>
              {getIssueTypeLabel(issue.type)}
            </span>
            <span className={`badge border ${getIssueSeverityColor(issue.severity)}`}>
              {getIssueSeverityLabel(issue.severity)}
            </span>
            <span className={cn('badge', getIssueStatusColor(issue.status))}>
              {getIssueStatusLabel(issue.status)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-200 mb-2">问题描述</h4>
            <p className="text-sm text-gray-300">{issue.description}</p>
          </div>

          {issue.relatedPrompts && issue.relatedPrompts.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-200 mb-2">关联提示词</h4>
              <div className="space-y-2">
                {issue.relatedPrompts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onNavigatePrompt(p.id)}
                    className="w-full text-left px-3 py-2 bg-bg-lighter rounded-md text-sm text-gray-300 hover:bg-bg-hover transition-colors"
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-gray-200 mb-3">操作日志</h4>
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-bg-border" />
              {logs.map((log, index) => {
                const ActionIcon = getActionIcon(log.action)
                return (
                  <div key={log.id} className="relative" style={{ animation: `fade-in 0.2s ease-out ${index * 0.03}s both` }}>
                    <div className={cn(
                      'absolute -left-4 w-6 h-6 rounded-full border-2 border-bg-card flex items-center justify-center',
                      getActionColor(log.action)
                    )}>
                      <ActionIcon className="w-3 h-3" />
                    </div>
                    <div className="bg-bg-lighter rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('chip text-xs', getActionColor(log.action))}>
                          {getActionLabel(log.action)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDateTime(log.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        <span className="text-gray-300">{log.actor}</span> · {log.comment}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {issue.status === 'open' && (
            <div>
              <h4 className="text-sm font-semibold text-gray-200 mb-2">提交修正方案</h4>
              <textarea
                value={fixPlan}
                onChange={e => setFixPlan(e.target.value)}
                placeholder="描述你的修正方案..."
                rows={4}
                className="input mb-3"
              />
              <button
                onClick={onSubmitFix}
                disabled={!fixPlan.trim()}
                className="btn-primary w-full"
              >
                <Send className="w-4 h-4" />
                提交修正
              </button>
            </div>
          )}

          {issue.status === 'fixing' && (
            <div>
              <h4 className="text-sm font-semibold text-gray-200 mb-2">确认修正</h4>
              {issue.fixPlan && (
                <div className="bg-bg-lighter rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <User className="w-3 h-3" />
                    {issue.fixedBy} 提交的修正方案
                  </div>
                  <p className="text-sm text-gray-300">{issue.fixPlan}</p>
                </div>
              )}
              <textarea
                value={confirmComment}
                onChange={e => setConfirmComment(e.target.value)}
                placeholder="确认意见（可选）"
                rows={3}
                className="input mb-3"
              />
              <button onClick={onConfirmFix} className="btn-success w-full">
                <CheckCircle2 className="w-4 h-4" />
                确认通过
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
