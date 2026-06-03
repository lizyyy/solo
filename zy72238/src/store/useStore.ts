import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Transaction,
  SupplementEmail,
  DifferenceItem,
  AuditLog,
  SelfCheckResult,
} from '@/types'

const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2)

const typeLabel = (type: 'principal' | 'fee') =>
  type === 'principal' ? '本金' : '手续费'

const roleLabel = (role: 'operator' | 'supervisor') =>
  role === 'operator' ? '对账运营' : '结算主管'

interface StoreState {
  transactions: Transaction[]
  supplementEmails: SupplementEmail[]
  differenceItems: DifferenceItem[]
  auditLogs: AuditLog[]
  selfCheckResults: SelfCheckResult[]
  currentRole: 'operator' | 'supervisor'

  importTransactions: (
    rows: {
      businessNo: string
      type: 'principal' | 'fee'
      amount: number
      counterTailNo: string
    }[]
  ) => void

  addSupplementEmail: (
    businessNo: string,
    content: string,
    emailAmount: number,
    emailCounterTailNo: string
  ) => void

  resolveConflict: (
    emailId: string,
    decision: 'confirmed' | 'rejected'
  ) => void

  reviewDifference: (
    itemId: string,
    approved: boolean,
    reviewer: string,
    note?: string
  ) => void

  runSelfCheck: () => SelfCheckResult[]

  exportData: () => string

  setCurrentRole: (role: 'operator' | 'supervisor') => void
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      transactions: [],
      supplementEmails: [],
      differenceItems: [],
      auditLogs: [],
      selfCheckResults: [],
      currentRole: 'operator' as const,

      importTransactions: (rows) => {
        const state = get()
        const checkResults: SelfCheckResult[] = []
        const newTransactions: Transaction[] = []
        const newDiffItems: DifferenceItem[] = []
        const validRows: typeof rows = []
        let duplicateCount = 0

        for (const row of rows) {
          const dupExisting = state.transactions.some(
            (t) =>
              t.businessNo === row.businessNo &&
              t.type === row.type &&
              t.counterTailNo === row.counterTailNo
          )
          const dupInBatch = validRows.some(
            (r) =>
              r.businessNo === row.businessNo &&
              r.type === row.type &&
              r.counterTailNo === row.counterTailNo
          )

          if (dupExisting || dupInBatch) {
            duplicateCount++
            checkResults.push({
              id: genId(),
              type: 'duplicate_import',
              severity: 'error',
              message: `业务号 ${row.businessNo} 的${typeLabel(row.type)}记录已存在，请勿重复导入`,
              relatedBusinessNos: [row.businessNo],
            })
          } else {
            validRows.push(row)
          }
        }

        const grouped: Record<string, typeof validRows> = {}
        for (const row of validRows) {
          if (!grouped[row.businessNo]) grouped[row.businessNo] = []
          grouped[row.businessNo].push(row)
        }

        const splitBusinessNos = new Set<string>()
        for (const [businessNo, group] of Object.entries(grouped)) {
          const hasPrincipal = group.some((r) => r.type === 'principal')
          const hasFee = group.some((r) => r.type === 'fee')
          const existingPrincipal = state.transactions.some(
            (t) => t.businessNo === businessNo && t.type === 'principal'
          )
          const existingFee = state.transactions.some(
            (t) => t.businessNo === businessNo && t.type === 'fee'
          )

          if ((hasPrincipal || existingPrincipal) && (hasFee || existingFee)) {
            splitBusinessNos.add(businessNo)
            checkResults.push({
              id: genId(),
              type: 'split_row',
              severity: 'warning',
              message: `业务号 ${businessNo} 同时存在手续费和本金两行记录，需结算主管复核`,
              relatedBusinessNos: [businessNo],
            })
          }
        }

        for (const row of validRows) {
          newTransactions.push({
            id: genId(),
            businessNo: row.businessNo,
            type: row.type,
            amount: row.amount,
            counterTailNo: row.counterTailNo,
            source: 'counter',
            status: splitBusinessNos.has(row.businessNo)
              ? 'pending_review'
              : 'normal',
            createdAt: new Date().toISOString(),
          })
        }

        for (const businessNo of splitBusinessNos) {
          newDiffItems.push({
            id: genId(),
            businessNo,
            category: 'split_row',
            description: `业务号 ${businessNo} 同时存在手续费和本金两行记录，需结算主管复核`,
            status: 'pending_review',
            createdAt: new Date().toISOString(),
          })
        }

        set({
          transactions: [...state.transactions, ...newTransactions],
          differenceItems: [...state.differenceItems, ...newDiffItems],
          selfCheckResults: [...state.selfCheckResults, ...checkResults],
          auditLogs: [
            ...state.auditLogs,
            {
              id: genId(),
              action: 'import',
              operator: roleLabel(state.currentRole),
              detail: `导入 ${validRows.length} 条柜台流水${duplicateCount > 0 ? `，${duplicateCount} 条重复记录已跳过` : ''}`,
              timestamp: new Date().toISOString(),
            },
          ],
        })
      },

      addSupplementEmail: (businessNo, content, emailAmount, emailCounterTailNo) => {
        const state = get()
        const existingTx = state.transactions.find(
          (t) => t.businessNo === businessNo
        )

        let conflictStatus: SupplementEmail['conflictStatus'] = 'none'
        let relatedTransactionId = ''

        if (existingTx) {
          relatedTransactionId = existingTx.id
          if (
            existingTx.amount !== emailAmount ||
            existingTx.counterTailNo !== emailCounterTailNo
          ) {
            conflictStatus = 'conflict'
          }
        }

        set({
          supplementEmails: [
            ...state.supplementEmails,
            {
              id: genId(),
              businessNo,
              content,
              emailAmount,
              emailCounterTailNo,
              relatedTransactionId,
              conflictStatus,
              operatorDecision: 'pending',
              createdAt: new Date().toISOString(),
            },
          ],
          auditLogs: [
            ...state.auditLogs,
            {
              id: genId(),
              action: 'supplement',
              operator: roleLabel(state.currentRole),
              detail: `补充邮件，业务号 ${businessNo}${conflictStatus === 'conflict' ? '，存在数据冲突' : ''}`,
              timestamp: new Date().toISOString(),
            },
          ],
        })
      },

      resolveConflict: (emailId, decision) => {
        const state = get()
        const email = state.supplementEmails.find((e) => e.id === emailId)
        if (!email) return

        const updatedEmails = state.supplementEmails.map((e) =>
          e.id === emailId
            ? { ...e, operatorDecision: decision, conflictStatus: 'resolved' as const }
            : e
        )

        let updatedTransactions = state.transactions
        let updatedDiffItems = [...state.differenceItems]
        let auditDetail = ''

        if (decision === 'confirmed' && email.relatedTransactionId) {
          const oldTx = state.transactions.find(
            (t) => t.id === email.relatedTransactionId
          )
          updatedTransactions = state.transactions.map((t) => {
            if (t.id !== email.relatedTransactionId) return t
            return {
              ...t,
              amount: email.emailAmount,
              counterTailNo: email.emailCounterTailNo,
            }
          })

          auditDetail = `对账运营确认邮件数据，业务号${email.businessNo}金额调整为${email.emailAmount}`

          if (
            oldTx &&
            (oldTx.amount !== email.emailAmount ||
              oldTx.counterTailNo !== email.emailCounterTailNo)
          ) {
            updatedDiffItems.push({
              id: genId(),
              businessNo: email.businessNo,
              category: 'data_mismatch',
              description: `业务号 ${email.businessNo} 经邮件确认调整：金额由 ${oldTx.amount} 调整为 ${email.emailAmount}，柜台尾号由 ${oldTx.counterTailNo} 调整为 ${email.emailCounterTailNo}`,
              status: 'open',
              createdAt: new Date().toISOString(),
            })
          }
        } else {
          auditDetail = '对账运营驳回邮件数据，保留原始流水'
        }

        set({
          supplementEmails: updatedEmails,
          transactions: updatedTransactions,
          differenceItems: updatedDiffItems,
          auditLogs: [
            ...state.auditLogs,
            {
              id: genId(),
              action: 'conflict_resolve',
              operator: roleLabel(state.currentRole),
              detail: auditDetail,
              timestamp: new Date().toISOString(),
            },
          ],
        })
      },

      reviewDifference: (itemId, approved, reviewer, note) => {
        const state = get()
        const diffItem = state.differenceItems.find((d) => d.id === itemId)
        if (!diffItem) return

        const updatedDiffItems = state.differenceItems.map((d) =>
          d.id === itemId
            ? {
                ...d,
                status: approved ? ('resolved' as const) : ('rejected' as const),
                reviewedBy: reviewer,
                reviewNote: note,
              }
            : d
        )

        const updatedTransactions = state.transactions.map((t) => {
          if (t.businessNo !== diffItem.businessNo) return t
          if (approved && t.status === 'pending_review') {
            return { ...t, status: 'reviewed' as const }
          }
          if (!approved && t.status === 'pending_review') {
            return { ...t, status: 'normal' as const }
          }
          return t
        })

        set({
          differenceItems: updatedDiffItems,
          transactions: updatedTransactions,
          auditLogs: [
            ...state.auditLogs,
            {
              id: genId(),
              action: 'review',
              operator: reviewer,
              detail: `${approved ? '通过' : '驳回'}差异项，业务号 ${diffItem.businessNo}${note ? `，备注：${note}` : ''}`,
              timestamp: new Date().toISOString(),
            },
          ],
        })
      },

      runSelfCheck: () => {
        const state = get()
        const results: SelfCheckResult[] = []

        const seen = new Map<string, Transaction>()
        for (const tx of state.transactions) {
          const key = `${tx.businessNo}|${tx.type}|${tx.counterTailNo}`
          if (seen.has(key)) {
            const existing = results.some(
              (r) =>
                r.type === 'duplicate_import' &&
                r.relatedBusinessNos.includes(tx.businessNo)
            )
            if (!existing) {
              results.push({
                id: genId(),
                type: 'duplicate_import',
                severity: 'error',
                message: `业务号 ${tx.businessNo} 的${typeLabel(tx.type)}记录已存在，请勿重复导入`,
                relatedBusinessNos: [tx.businessNo],
              })
            }
          } else {
            seen.set(key, tx)
          }
        }

        const businessNoTypes: Record<string, Set<string>> = {}
        for (const tx of state.transactions) {
          if (!businessNoTypes[tx.businessNo]) {
            businessNoTypes[tx.businessNo] = new Set()
          }
          businessNoTypes[tx.businessNo].add(tx.type)
        }
        for (const [businessNo, types] of Object.entries(businessNoTypes)) {
          if (types.has('principal') && types.has('fee')) {
            results.push({
              id: genId(),
              type: 'split_row',
              severity: 'warning',
              message: `业务号 ${businessNo} 同时存在手续费和本金两行记录，需结算主管复核`,
              relatedBusinessNos: [businessNo],
            })
          }
        }

        for (const email of state.supplementEmails) {
          if (email.operatorDecision === 'confirmed') {
            const hasMatchingDiff = state.differenceItems.some(
              (d) =>
                d.businessNo === email.businessNo &&
                d.category === 'data_mismatch'
            )
            if (!hasMatchingDiff) {
              results.push({
                id: genId(),
                type: 'recalc_mismatch',
                severity: 'warning',
                message: `业务号 ${email.businessNo} 已通过邮件确认调整，但未找到对应的数据差异记录`,
                relatedBusinessNos: [email.businessNo],
              })
            }
          }
        }

        const checkedBusinessNos = new Set<string>()
        for (const tx of state.transactions) {
          if (tx.status === 'pending_review' && !checkedBusinessNos.has(tx.businessNo)) {
            checkedBusinessNos.add(tx.businessNo)
            const hasDiff = state.differenceItems.some(
              (d) =>
                d.businessNo === tx.businessNo &&
                (d.status === 'pending_review' || d.status === 'open')
            )
            if (!hasDiff) {
              results.push({
                id: genId(),
                type: 'export_inconsistency',
                severity: 'error',
                message: `业务号 ${tx.businessNo} 存在待复核的流水记录，但没有对应的待处理差异项`,
                relatedBusinessNos: [tx.businessNo],
              })
            }
          }
        }

        set({ selfCheckResults: results })
        return results
      },

      exportData: () => {
        const state = get()
        const data = {
          transactions: state.transactions,
          supplementEmails: state.supplementEmails,
          differenceItems: state.differenceItems,
          auditLogs: state.auditLogs,
          selfCheckResults: state.selfCheckResults,
        }

        set({
          auditLogs: [
            ...state.auditLogs,
            {
              id: genId(),
              action: 'export',
              operator: roleLabel(state.currentRole),
              detail: `导出数据，共 ${state.transactions.length} 条流水记录`,
              timestamp: new Date().toISOString(),
            },
          ],
        })

        return JSON.stringify(data, null, 2)
      },

      setCurrentRole: (role) => {
        set({ currentRole: role })
      },
    }),
    {
      name: 'otc-knockin-monitor',
    }
  )
)
