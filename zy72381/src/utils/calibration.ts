import type { DirectionValidationResult } from '@/types'

export function validateDirection(directionMark: string): DirectionValidationResult {
  const normalized = directionMark.trim()

  if (normalized === '负方向' || normalized === 'negative' || normalized === 'Negative') {
    return {
      isValid: true,
      needsReview: false,
      normalizedDirection: 'negative'
    }
  }

  if (normalized === '正方向' || normalized === 'positive' || normalized === 'Positive') {
    return {
      isValid: true,
      needsReview: false,
      normalizedDirection: 'positive'
    }
  }

  if (normalized === '向左' || normalized === 'left' || normalized === 'Left') {
    return {
      isValid: true,
      needsReview: true,
      warning: '方向标记为"向左"，需实验老师复核确认是否为负方向'
    }
  }

  if (normalized === '向右' || normalized === 'right' || normalized === 'Right') {
    return {
      isValid: true,
      needsReview: true,
      warning: '方向标记为"向右"，需实验老师复核确认是否为正方向'
    }
  }

  return {
    isValid: false,
    needsReview: true,
    warning: `无法识别的方向标记: ${directionMark}`
  }
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'pending_import': '待导入',
    'imported': '已导入',
    'calibrating': '校准中',
    'success': '顺利',
    'pending_review': '待复核',
    'supplemented': '已补录',
    'reviewed_negative': '已复核-负方向',
    'reviewed_normal': '已复核-正常',
    'manual_corrected': '已人工修正',
    'rerun': '已重跑'
  }
  return labels[status] || status
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'success': 'bg-success-500',
    'pending_review': 'bg-warning-500',
    'supplemented': 'bg-supplement-500',
    'reviewed_negative': 'bg-supplement-500',
    'reviewed_normal': 'bg-success-500',
    'manual_corrected': 'bg-warning-500',
    'rerun': 'bg-industrial-500'
  }
  return colors[status] || 'bg-gray-500'
}

export function getExceptionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'direction_mismatch': '方向口径不统一',
    'missing_sensor': '缺失传感器编号',
    'supplemented': '已补录'
  }
  return labels[type] || type
}

export function getExceptionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'pending': '待处理',
    'pending_review': '待实验老师复核',
    'supplemented': '已补录',
    'resolved': '已解决'
  }
  return labels[status] || status
}

export function getOperationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'import': '导入记录',
    'calibrate': '口径校验',
    'supplement': '补录传感器',
    'correct': '人工修正',
    'rerun': '重跑估算',
    'review': '复核'
  }
  return labels[type] || type
}
