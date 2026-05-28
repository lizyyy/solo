import db from '../db.js'

interface ReservationFilter {
  security_code?: string
  client_account?: string
  status?: string
  date_from?: string
  date_to?: string
}

const STATUS_MAP: Record<string, string> = {
  pending: '待确认',
  locked: '已锁定',
  returned: '已归还',
  overdue: '逾期未还',
  cancelled: '已撤单',
  compensation_error: '回补异常',
}

function escapeCsv(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildFilterClause(filter: ReservationFilter, alias: string = 'r') {
  const conditions: string[] = []
  const params: any[] = []

  if (filter.security_code) {
    conditions.push(`${alias}.security_code = ?`)
    params.push(filter.security_code)
  }
  if (filter.client_account) {
    conditions.push(`${alias}.client_account = ?`)
    params.push(filter.client_account)
  }
  if (filter.status) {
    conditions.push(`${alias}.status = ?`)
    params.push(filter.status)
  }
  if (filter.date_from) {
    conditions.push(`${alias}.reserve_date >= ?`)
    params.push(filter.date_from)
  }
  if (filter.date_to) {
    conditions.push(`${alias}.reserve_date <= ?`)
    params.push(filter.date_to)
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
  return { whereClause, params }
}

function exportReservationsCsv(filter: ReservationFilter = {}): string {
  const { whereClause, params } = buildFilterClause(filter)

  const rows = db.prepare(`
    SELECT * FROM reservation r
    ${whereClause}
    ORDER BY r.created_at DESC
  `).all(...params) as any[]

  const headers = [
    '预约单号', '客户账户', '客户名称', '客户优先级', '证券代码', '证券名称',
    '预约数量', '状态', '预约日期', '到期日期', '归还日期', '撤单日期',
    '撤单原因', '补偿状态', '创建时间',
  ]

  const lines: string[] = [headers.join(',')]

  for (const row of rows) {
    const compensationLabel = row.compensation_status === 'success' ? '成功'
      : row.compensation_status === 'failed' ? '失败' : ''
    const line = [
      escapeCsv(row.id),
      escapeCsv(row.client_account),
      escapeCsv(row.client_name),
      escapeCsv(row.client_priority),
      escapeCsv(row.security_code),
      escapeCsv(row.security_name),
      escapeCsv(row.quantity),
      escapeCsv(STATUS_MAP[row.status] || row.status),
      escapeCsv(row.reserve_date),
      escapeCsv(row.due_date),
      escapeCsv(row.return_date),
      escapeCsv(row.cancel_date),
      escapeCsv(row.cancel_reason),
      escapeCsv(compensationLabel),
      escapeCsv(row.created_at),
    ].join(',')
    lines.push(line)
  }

  return lines.join('\n')
}

export default { exportReservationsCsv }
