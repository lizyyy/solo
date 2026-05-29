const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  paid: 1,
  failed: 2,
  refunded: 3,
  cancelled: 4,
}

export function getStatusOrder(status: string): number {
  return STATUS_ORDER[status] ?? -1
}

export function detectStatusRegression(currentStatus: string, newStatus: string): boolean {
  if (!currentStatus) return false
  const currentOrder = getStatusOrder(currentStatus)
  const newOrder = getStatusOrder(newStatus)
  if (currentOrder === -1 || newOrder === -1) return true
  return newOrder < currentOrder
}
