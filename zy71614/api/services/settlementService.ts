import { AppDataSource } from '../database.js'
import { FilmContract } from '../entities/FilmContract.js'
import { SettlementResult } from '../entities/SettlementResult.js'
import { BoxOfficeRecord } from '../entities/BoxOfficeRecord.js'
import { SettlementTask } from '../entities/SettlementTask.js'

const contractRepo = () => AppDataSource.getRepository(FilmContract)
const resultRepo = () => AppDataSource.getRepository(SettlementResult)
const recordRepo = () => AppDataSource.getRepository(BoxOfficeRecord)
const taskRepo = () => AppDataSource.getRepository(SettlementTask)

export async function importContracts(taskId: string, data: any[]): Promise<{ imported: number; errors: number }> {
  const task = await taskRepo().findOne({ where: { id: taskId } })
  if (!task) throw new Error('Task not found')

  let imported = 0
  let errors = 0

  for (const item of data) {
    try {
      const contract = contractRepo().create({
        filmName: item.filmName ?? '',
        distributor: item.distributor ?? '',
        shareRatio: Number(item.shareRatio ?? 0),
        minimumGuarantee: item.minimumGuarantee != null ? Number(item.minimumGuarantee) : null,
        isTiered: item.isTiered ?? false,
        tierRules: item.tierRules ? (typeof item.tierRules === 'string' ? item.tierRules : JSON.stringify(item.tierRules)) : null,
        task,
      })

      if (!contract.filmName || !contract.distributor || contract.shareRatio <= 0) {
        errors++
        continue
      }

      await contractRepo().save(contract)
      imported++
    } catch (err: any) {
      errors++
    }
  }

  return { imported, errors }
}

function applyTieredRules(grossAmount: number, tierRulesStr: string): number {
  const tiers = JSON.parse(tierRulesStr)
  if (!Array.isArray(tiers)) return grossAmount

  let settlement = 0
  let remaining = grossAmount

  for (const tier of tiers) {
    const threshold = Number(tier.threshold ?? 0)
    const ratio = Number(tier.ratio ?? 0)

    if (remaining <= 0) break

    const taxable = threshold > 0 ? Math.min(remaining, threshold) : remaining
    settlement += taxable * ratio
    remaining -= taxable
  }

  if (remaining > 0 && tiers.length > 0) {
    const lastRatio = Number(tiers[tiers.length - 1].ratio ?? 0)
    settlement += remaining * lastRatio
  }

  return settlement
}

export async function calculateSettlement(taskId: string): Promise<{ calculated: number; errors: number }> {
  const task = await taskRepo().findOne({ where: { id: taskId } })
  if (!task) throw new Error('Task not found')

  const contracts = await contractRepo().find({ where: { task: { id: taskId } } })
  const records = await recordRepo().find({ where: { task: { id: taskId } } })

  const filmGross = new Map<string, number>()
  for (const r of records) {
    if (r.recordStatus === 'error') continue
    const key = r.filmName
    filmGross.set(key, (filmGross.get(key) ?? 0) + r.netAmount)
  }

  await resultRepo().delete({ task: { id: taskId } })

  let calculated = 0
  let errors = 0

  for (const contract of contracts) {
    try {
      const grossAmount = filmGross.get(contract.filmName) ?? 0
      let settlementAmount: number
      let remark: string | null = null

      if (contract.isTiered && contract.tierRules) {
        settlementAmount = applyTieredRules(grossAmount, contract.tierRules)
        remark = '阶梯分账'
      } else {
        settlementAmount = grossAmount * contract.shareRatio
      }

      const guaranteeAmount = contract.minimumGuarantee ?? 0
      const finalAmount = Math.max(settlementAmount, guaranteeAmount)

      if (guaranteeAmount > 0 && settlementAmount < guaranteeAmount) {
        remark = remark ? `${remark}; 保底补差` : '保底补差'
      }

      const result = resultRepo().create({
        filmName: contract.filmName,
        distributor: contract.distributor,
        grossAmount,
        shareRatio: contract.shareRatio,
        settlementAmount,
        guaranteeAmount,
        finalAmount,
        remark,
        task,
        contract,
      })

      await resultRepo().save(result)
      calculated++
    } catch (err: any) {
      errors++
    }
  }

  const results = await resultRepo().find({ where: { task: { id: taskId } } })
  task.totalSettlement = results.reduce((sum, r) => sum + r.finalAmount, 0)

  return { calculated, errors }
}
