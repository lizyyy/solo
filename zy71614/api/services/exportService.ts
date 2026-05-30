import * as XLSX from 'xlsx'
import { AppDataSource } from '../database.js'
import { SettlementResult } from '../entities/SettlementResult.js'

const resultRepo = () => AppDataSource.getRepository(SettlementResult)

export async function exportExcel(taskId: string): Promise<Buffer> {
  const results = await resultRepo().find({ where: { task: { id: taskId } } })

  const rows = results.map((r) => ({
    '影片名称': r.filmName,
    '发行方': r.distributor,
    '票房总额': r.grossAmount,
    '分账比例': r.shareRatio,
    '分账金额': r.settlementAmount,
    '保底金额': r.guaranteeAmount,
    '最终金额': r.finalAmount,
    '备注': r.remark ?? '',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  const colWidths = [
    { wch: 20 },
    { wch: 15 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 20 },
  ]
  ws['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, '分账结算')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return Buffer.from(buf)
}
