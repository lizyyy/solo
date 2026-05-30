import { AppDataSource } from '../database.js'
import { BoxOfficeRecord } from '../entities/BoxOfficeRecord.js'
import { SettlementTask } from '../entities/SettlementTask.js'

const recordRepo = () => AppDataSource.getRepository(BoxOfficeRecord)
const taskRepo = () => AppDataSource.getRepository(SettlementTask)

async function recalculateTaskTotals(taskId: string): Promise<void> {
  const records = await recordRepo().find({ where: { task: { id: taskId } } })
  const task = await taskRepo().findOne({ where: { id: taskId } })
  if (!task) return

  task.totalGross = records.reduce((sum, r) => sum + r.ticketAmount, 0)
  task.totalRefund = records.reduce((sum, r) => sum + r.refundAmount, 0)
  task.totalCoupon = records.reduce((sum, r) => sum + r.couponAmount, 0)
  task.netGross = records.reduce((sum, r) => sum + r.netAmount, 0)
  task.errorCount = records.filter((r) => r.recordStatus === 'error').length

  await taskRepo().save(task)
}

function validateRecord(record: Partial<BoxOfficeRecord>): string | null {
  if (!record.ticketNo) return 'Missing ticketNo'
  if (!record.showCode) return 'Missing showCode'
  if (!record.filmName) return 'Missing filmName'
  if (!record.showTime) return 'Missing showTime'
  if (record.ticketAmount == null || record.ticketAmount < 0) return 'Invalid ticketAmount'
  if (record.refundAmount == null || record.refundAmount < 0) return 'Invalid refundAmount'
  if (record.couponAmount == null || record.couponAmount < 0) return 'Invalid couponAmount'
  return null
}

export async function importTickets(taskId: string, data: any[]): Promise<{ imported: number; errors: number }> {
  const task = await taskRepo().findOne({ where: { id: taskId } })
  if (!task) throw new Error('Task not found')

  let imported = 0
  let errors = 0

  for (const item of data) {
    try {
      const ticketAmount = Number(item.ticketAmount ?? item.amount ?? 0)
      const refundAmount = Number(item.refundAmount ?? 0)
      const couponAmount = Number(item.couponAmount ?? 0)
      const netAmount = ticketAmount - refundAmount - couponAmount

      const record = recordRepo().create({
        ticketNo: item.ticketNo ?? '',
        showCode: item.showCode ?? '',
        filmName: item.filmName ?? '',
        showTime: item.showTime ?? '',
        ticketAmount,
        refundAmount,
        couponAmount,
        netAmount,
        recordStatus: 'normal' as string,
        errorMessage: null,
        diffNote: null,
        mapped: false,
        sessionId: null,
        contractId: null,
        diffHash: null,
        task,
      })

      const validationError = validateRecord(record)
      if (validationError) {
        record.recordStatus = 'error'
        record.errorMessage = validationError
        errors++
      }

      if (refundAmount > ticketAmount) {
        record.recordStatus = 'warning'
        record.diffNote = '退票漏扣: 退款金额大于票面金额'
      }

      await recordRepo().save(record)
      imported++
    } catch (err: any) {
      errors++
    }
  }

  await recalculateTaskTotals(taskId)
  return { imported, errors }
}

export async function importRefunds(taskId: string, data: any[]): Promise<{ imported: number; errors: number }> {
  const task = await taskRepo().findOne({ where: { id: taskId } })
  if (!task) throw new Error('Task not found')

  let imported = 0
  let errors = 0

  for (const item of data) {
    try {
      const ticketNo = item.ticketNo ?? ''
      const existing = await recordRepo().findOne({
        where: { ticketNo, task: { id: taskId } },
      })

      if (existing) {
        const refundAmount = Number(item.refundAmount ?? item.amount ?? 0)
        existing.refundAmount = refundAmount
        existing.netAmount = existing.ticketAmount - refundAmount - existing.couponAmount

        if (refundAmount > existing.ticketAmount) {
          existing.recordStatus = 'warning'
          existing.diffNote = '退票漏扣: 退款金额大于票面金额'
        }

        await recordRepo().save(existing)
        imported++
      } else {
        const refundAmount = Number(item.refundAmount ?? item.amount ?? 0)
        const ticketAmount = Number(item.ticketAmount ?? 0)
        const couponAmount = Number(item.couponAmount ?? 0)
        const netAmount = ticketAmount - refundAmount - couponAmount

        const record = recordRepo().create({
          ticketNo,
          showCode: item.showCode ?? '',
          filmName: item.filmName ?? '',
          showTime: item.showTime ?? '',
          ticketAmount,
          refundAmount,
          couponAmount,
          netAmount,
          recordStatus: refundAmount > ticketAmount ? 'warning' : 'normal',
          errorMessage: refundAmount > ticketAmount ? null : null,
          diffNote: refundAmount > ticketAmount ? '退票漏扣: 退款金额大于票面金额' : null,
          mapped: false,
          sessionId: null,
          contractId: null,
          diffHash: null,
          task,
        })

        if (refundAmount > ticketAmount) {
          record.recordStatus = 'warning'
          record.diffNote = '退票漏扣: 退款金额大于票面金额'
        }

        await recordRepo().save(record)
        imported++
      }
    } catch (err: any) {
      errors++
    }
  }

  await recalculateTaskTotals(taskId)
  return { imported, errors }
}

export async function importCoupons(taskId: string, data: any[]): Promise<{ imported: number; errors: number }> {
  const task = await taskRepo().findOne({ where: { id: taskId } })
  if (!task) throw new Error('Task not found')

  let imported = 0
  let errors = 0

  for (const item of data) {
    try {
      const ticketNo = item.ticketNo ?? ''
      const existing = await recordRepo().findOne({
        where: { ticketNo, task: { id: taskId } },
      })

      if (existing) {
        const couponAmount = Number(item.couponAmount ?? item.amount ?? 0)
        existing.couponAmount = couponAmount
        existing.netAmount = existing.ticketAmount - existing.refundAmount - couponAmount

        if (couponAmount > existing.ticketAmount) {
          existing.recordStatus = 'error'
          existing.errorMessage = '券抵扣误算: 券金额大于票面金额'
        }

        await recordRepo().save(existing)
        imported++
      } else {
        const couponAmount = Number(item.couponAmount ?? item.amount ?? 0)
        const ticketAmount = Number(item.ticketAmount ?? 0)
        const refundAmount = Number(item.refundAmount ?? 0)
        const netAmount = ticketAmount - refundAmount - couponAmount

        const record = recordRepo().create({
          ticketNo,
          showCode: item.showCode ?? '',
          filmName: item.filmName ?? '',
          showTime: item.showTime ?? '',
          ticketAmount,
          refundAmount,
          couponAmount,
          netAmount,
          recordStatus: couponAmount > ticketAmount ? 'error' : 'normal',
          errorMessage: couponAmount > ticketAmount ? '券抵扣误算: 券金额大于票面金额' : null,
          diffNote: null,
          mapped: false,
          sessionId: null,
          contractId: null,
          diffHash: null,
          task,
        })

        await recordRepo().save(record)
        imported++
      }
    } catch (err: any) {
      errors++
    }
  }

  await recalculateTaskTotals(taskId)
  return { imported, errors }
}

export async function getBoxOfficeRecords(taskId: string): Promise<BoxOfficeRecord[]> {
  return recordRepo().find({ where: { task: { id: taskId } }, order: { createdAt: 'ASC' } })
}

export async function updateDiffNote(recordId: string, diffNote: string): Promise<BoxOfficeRecord | null> {
  const record = await recordRepo().findOne({ where: { id: recordId } })
  if (!record) return null
  record.diffNote = diffNote
  return recordRepo().save(record)
}
