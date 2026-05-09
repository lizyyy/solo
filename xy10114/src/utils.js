export const STATUS_MAP = {
  'pending': { label: '待处理', color: '#9ca3af' },
  'reviewing': { label: '审核中', color: '#f59e0b' },
  'completed': { label: '已完成', color: '#16a34a' },
  'archived': { label: '已归档', color: '#6b7280' }
}

export const RISK_LEVEL_MAP = {
  'high': { label: '高风险', color: '#dc2626' },
  'medium': { label: '中风险', color: '#f59e0b' },
  'low': { label: '低风险', color: '#3b82f6' },
  'none': { label: '无风险', color: '#16a34a' }
}

export const ADOPTION_STATUS_MAP = {
  'pending': { label: '待采纳', color: '#9ca3af' },
  'accepted': { label: '已采纳', color: '#16a34a' },
  'rejected': { label: '已拒绝', color: '#dc2626' },
  'needs_review': { label: '需复核', color: '#f59e0b' }
}

export const CLAUSE_TYPE_MAP = {
  'liability': { label: '责任条款' },
  'payment': { label: '付款条款' },
  'termination': { label: '终止条款' },
  'ip': { label: '知识产权' },
  'confidentiality': { label: '保密条款' },
  'warranty': { label: '保修条款' },
  'other': { label: '其他' }
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

export function formatShortDate(dateStr) {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  } catch {
    return dateStr
  }
}

export function truncateText(text, maxLength = 50) {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}
