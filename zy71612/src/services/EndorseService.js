import db from '../database/index.js'
import { EndorseType } from '../models/types.js'
import billService from './BillService.js'
import dayjs from 'dayjs'

class EndorseService {
  generateId() {
    return `endorse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async addEndorsement(endorseData) {
    const bill = await billService.getBillById(endorseData.billId)
    if (!bill) {
      throw new Error('票据不存在')
    }

    const endorsements = await this.getEndorsementsByBill(endorseData.billId)
    const nextSequence = endorsements.length + 1

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const endorsement = {
      id: this.generateId(),
      billId: endorseData.billId,
      billNo: bill.billNo,
      sequence: nextSequence,
      endorseType: endorseData.endorseType || EndorseType.TRANSFER,
      endorser: endorseData.endorser?.trim() || bill.holder,
      endorsee: endorseData.endorsee?.trim() || '',
      endorseDate: endorseData.endorseDate || dayjs().format('YYYY-MM-DD'),
      amount: Number(endorseData.amount) || bill.amount,
      remark: endorseData.remark || '',
      isBroken: false,
      breakReason: '',
      createdAt: now,
      updatedAt: now
    }

    if (!endorsement.endorsee) {
      throw new Error('被背书人不能为空')
    }

    await db.add('endorses', endorsement)
    return endorsement
  }

  async getEndorsementsByBill(billId) {
    const endorsements = await db.getAllFromIndex('endorses', 'billId', billId)
    return endorsements.sort((a, b) => a.sequence - b.sequence)
  }

  async getEndorsementById(id) {
    return await db.get('endorses', id)
  }

  async updateEndorsement(id, endorseData) {
    const existing = await db.get('endorses', id)
    if (!existing) {
      throw new Error('背书记录不存在')
    }

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const updated = {
      ...existing,
      ...endorseData,
      id: existing.id,
      billId: existing.billId,
      billNo: existing.billNo,
      sequence: existing.sequence,
      updatedAt: now
    }

    await db.put('endorses', updated)
    return updated
  }

  async deleteEndorsement(id) {
    const endorsement = await db.get('endorses', id)
    if (!endorsement) {
      throw new Error('背书记录不存在')
    }
    await db.delete('endorses', id)
    return true
  }

  async checkEndorseChain(billId) {
    const endorsements = await this.getEndorsementsByBill(billId)
    const issues = []

    if (endorsements.length === 0) {
      return {
        isComplete: true,
        issues: [],
        chain: []
      }
    }

    let previousEndorsee = null
    for (let i = 0; i < endorsements.length; i++) {
      const current = endorsements[i]

      if (current.sequence !== i + 1) {
        issues.push({
          type: 'sequence_gap',
          sequence: current.sequence,
          expected: i + 1,
          message: `背书序号不连续，期望 ${i + 1}，实际 ${current.sequence}`
        })
      }

      if (i > 0 && previousEndorsee) {
        if (current.endorser !== previousEndorsee) {
          issues.push({
            type: 'chain_break',
            sequence: current.sequence,
            endorser: current.endorser,
            expectedEndorser: previousEndorsee,
            message: `背书链断裂：第${current.sequence}手背书人 "${current.endorser}" 与前手被背书人 "${previousEndorsee}" 不匹配`
          })
        }
      }

      if (!current.endorser || !current.endorsee) {
        issues.push({
          type: 'missing_info',
          sequence: current.sequence,
          message: `第${current.sequence}手背书信息不完整`
        })
      }

      previousEndorsee = current.endorsee
    }

    return {
      isComplete: issues.length === 0,
      issues,
      chain: endorsements
    }
  }

  async markChainBroken(billId, breakReason) {
    const endorsements = await this.getEndorsementsByBill(billId)
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')

    for (const endorsement of endorsements) {
      endorsement.isBroken = true
      endorsement.breakReason = breakReason
      endorsement.updatedAt = now
      await db.put('endorses', endorsement)
    }

    return true
  }

  async getChainStatistics() {
    const allEndorsements = await db.getAll('endorses')
    const billMap = new Map()

    allEndorsements.forEach(e => {
      if (!billMap.has(e.billId)) {
        billMap.set(e.billId, [])
      }
      billMap.get(e.billId).push(e)
    })

    let brokenChains = 0
    let totalBills = billMap.size

    for (const [billId, endorsements] of billMap) {
      const sorted = endorsements.sort((a, b) => a.sequence - b.sequence)
      let broken = false
      let prevEndorsee = null

      for (let i = 0; i < sorted.length; i++) {
        if (i > 0 && prevEndorsee && sorted[i].endorser !== prevEndorsee) {
          broken = true
          break
        }
        prevEndorsee = sorted[i].endorsee
      }

      if (broken) brokenChains++
    }

    return {
      totalBillsWithEndorses: totalBills,
      brokenChains,
      healthyChains: totalBills - brokenChains,
      totalEndorsements: allEndorsements.length
    }
  }
}

export const endorseService = new EndorseService()
export default endorseService
