import { OrderStatus } from '../types'

export const STATUS_LABELS: Record<OrderStatus, string> = {
  'pending': '待加工',
  'measuring': '测量中',
  'cutting': '切割中',
  'polishing': '抛光中',
  'edging': '磨边中',
  'quality-check': '质检中',
  'rework': '返工中',
  'ready': '可取镜',
  'picked-up': '已取镜'
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  'pending': 'bg-gray-100 text-gray-700 border-gray-300',
  'measuring': 'bg-blue-100 text-blue-700 border-blue-300',
  'cutting': 'bg-orange-100 text-orange-700 border-orange-300',
  'polishing': 'bg-purple-100 text-purple-700 border-purple-300',
  'edging': 'bg-yellow-100 text-yellow-700 border-yellow-300',
  'quality-check': 'bg-indigo-100 text-indigo-700 border-indigo-300',
  'rework': 'bg-red-100 text-red-700 border-red-300',
  'ready': 'bg-green-100 text-green-700 border-green-300',
  'picked-up': 'bg-emerald-100 text-emerald-700 border-emerald-300'
}

export const STATUS_FLOW: OrderStatus[] = [
  'pending',
  'measuring',
  'cutting',
  'polishing',
  'edging',
  'quality-check',
  'ready',
  'picked-up'
]

export const getNextStatus = (current: OrderStatus): OrderStatus | null => {
  const index = STATUS_FLOW.indexOf(current)
  if (index === -1 || index >= STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[index + 1]
}

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
