import { cn } from '@/lib/utils'
import { Check, X, AlertCircle, Clock } from 'lucide-react'

export function getRatingColor(rating: number): string {
  if (rating >= 8) return 'text-status-success bg-status-success/15 border-status-success/30'
  if (rating >= 6) return 'text-status-warning bg-status-warning/15 border-status-warning/30'
  return 'text-status-danger bg-status-danger/15 border-status-danger/30'
}

export function getIssueTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    duplicate: '内容重复',
    rating_inconsistency: '评分口径不一',
    deprecated_usage: '旧提示词误用',
  }
  return labels[type] || type
}

export function getIssueTypeColor(type: string): string {
  const colors: Record<string, string> = {
    duplicate: 'text-status-warning bg-status-warning/15 border-status-warning/30',
    rating_inconsistency: 'text-status-info bg-status-info/15 border-status-info/30',
    deprecated_usage: 'text-status-danger bg-status-danger/15 border-status-danger/30',
  }
  return colors[type] || ''
}

export function getIssueSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
  }
  return labels[severity] || severity
}

export function getIssueSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    low: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
    medium: 'text-status-warning bg-status-warning/15 border-status-warning/30',
    high: 'text-status-danger bg-status-danger/15 border-status-danger/30',
  }
  return colors[severity] || ''
}

export function getIssueStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: '待修正',
    fixing: '修正中',
    confirmed: '已确认',
    closed: '已关闭',
  }
  return labels[status] || status
}

export function getIssueStatusColor(status: string): string {
  const colors: Record<string, string> = {
    open: 'text-status-warning bg-status-warning/15',
    fixing: 'text-status-info bg-status-info/15',
    confirmed: 'text-status-success bg-status-success/15',
    closed: 'text-gray-400 bg-gray-500/15',
  }
  return colors[status] || ''
}

export function getStatusBadge(status: string) {
  const configs: Record<string, { icon: any; text: string; color: string }> = {
    active: { icon: Check, text: '在用', color: 'bg-status-success/15 text-status-success border-status-success/30' },
    deprecated: { icon: X, text: '弃用', color: 'bg-status-danger/15 text-status-danger border-status-danger/30' },
    archived: { icon: Clock, text: '归档', color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  }
  const config = configs[status] || configs.active
  const Icon = config.icon
  return (
    <span className={cn('badge border', config.color)}>
      <Icon className="w-3 h-3 mr-1" />
      {config.text}
    </span>
  )
}

export function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    created: '创建问题',
    fix_submitted: '提交修正',
    fix_confirmed: '确认通过',
    fix_rejected: '驳回修正',
    closed: '关闭问题',
  }
  return labels[action] || action
}

export function getActionIcon(action: string) {
  const icons: Record<string, any> = {
    created: AlertCircle,
    fix_submitted: Clock,
    fix_confirmed: Check,
    fix_rejected: X,
    closed: X,
  }
  return icons[action] || AlertCircle
}

export function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    created: 'bg-status-warning/20 text-status-warning border-status-warning/30',
    fix_submitted: 'bg-status-info/20 text-status-info border-status-info/30',
    fix_confirmed: 'bg-status-success/20 text-status-success border-status-success/30',
    fix_rejected: 'bg-status-danger/20 text-status-danger border-status-danger/30',
    closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }
  return colors[action] || ''
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays} 天前`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`

  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function highlightText(text: string, query: string): string {
  if (!query.trim()) return text
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

export function similarityLabel(similarity: number): string {
  return `${Math.round(similarity * 100)}%`
}

export function similarityColor(similarity: number): string {
  if (similarity >= 0.9) return 'text-status-danger bg-status-danger/15 border-status-danger/30'
  if (similarity >= 0.7) return 'text-status-warning bg-status-warning/15 border-status-warning/30'
  if (similarity >= 0.5) return 'text-status-info bg-status-info/15 border-status-info/30'
  return 'text-gray-400 bg-gray-500/15 border-gray-500/30'
}
