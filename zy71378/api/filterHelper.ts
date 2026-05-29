export function buildFilterClause(query: Record<string, any>): { where: string; params: any[] } {
  const conditions: string[] = []
  const params: any[] = []

  if (query.signature_status) {
    conditions.push('signature_status = ?')
    params.push(query.signature_status)
  }
  if (query.order_status) {
    conditions.push('order_status = ?')
    params.push(query.order_status)
  }
  if (query.processing_result) {
    conditions.push('processing_result = ?')
    params.push(query.processing_result)
  }
  if (query.confirm_status) {
    conditions.push('confirm_status = ?')
    params.push(query.confirm_status)
  }
  if (query.retry_min) {
    conditions.push('retry_count >= ?')
    params.push(parseInt(query.retry_min, 10))
  }
  if (query.retry_max) {
    conditions.push('retry_count <= ?')
    params.push(parseInt(query.retry_max, 10))
  }
  if (query.from) {
    conditions.push('timestamp >= ?')
    params.push(query.from)
  }
  if (query.to) {
    conditions.push('timestamp <= ?')
    params.push(query.to)
  }

  return {
    where: conditions.length > 0 ? conditions.join(' AND ') : '',
    params,
  }
}
