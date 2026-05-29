export function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function timeAgo(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  return formatDate(isoString)
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'text-accent-amber'
    case 'in_progress':
      return 'text-accent-yellow'
    case 'resolved':
      return 'text-accent-green'
    case 'confirmed':
      return 'text-accent-green'
    default:
      return 'text-slate-400'
  }
}

export function getStatusBgClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-accent-amber/10 text-accent-amber border-accent-amber/30'
    case 'in_progress':
      return 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30'
    case 'resolved':
      return 'bg-accent-green/10 text-accent-green border-accent-green/30'
    case 'confirmed':
      return 'bg-accent-green/10 text-accent-green border-accent-green/30'
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30'
  }
}

export function getAnomalyTypeColor(type: string): string {
  switch (type) {
    case 'channel_invalid':
      return 'text-accent-red'
    case 'duplicate':
      return 'text-accent-amber'
    case 'overwrite':
      return 'text-accent-orange'
    default:
      return 'text-slate-400'
  }
}

export function getAnomalyIcon(type: string): string {
  switch (type) {
    case 'channel_invalid':
      return '⚠️'
    case 'duplicate':
      return '🔄'
    case 'overwrite':
      return '⚠️'
    default:
      return '❓'
  }
}
