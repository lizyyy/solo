import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import Papa from 'papaparse'
import type {
  ReconciliationRecord,
  ReconciliationStatus,
  ImportStrategy,
  ImportResult,
  ManualNote,
  PaymentFlow,
  RefundRequest,
  ApprovalMail,
} from '@/types'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function computeAutoVerdict(record: {
  flowAmount: number | null
  contractAmount: number | null
  insuranceAmount: number | null
}): ReconciliationStatus {
  if (
    record.flowAmount === null ||
    record.contractAmount === null ||
    record.insuranceAmount === null
  ) {
    return 'pending'
  }
  if (record.flowAmount === record.contractAmount) {
    return 'matched'
  }
  return 'diff'
}

function computeDiffAmount(
  flowAmount: number | null,
  contractAmount: number | null
): number | null {
  if (flowAmount === null || contractAmount === null) return null
  return Math.round((flowAmount - contractAmount) * 100) / 100
}

interface ReconciliationState {
  records: ReconciliationRecord[]
  importRecords: (
    data: Partial<ReconciliationRecord>[],
    strategy: ImportStrategy
  ) => ImportResult
  updateVerdict: (
    id: string,
    verdict: ReconciliationStatus,
    reason: string
  ) => void
  revertVerdict: (id: string) => void
  addNote: (id: string, content: string, author: string) => void
  exportDiffReport: () => string
  clearAll: () => void
  getRecordById: (id: string) => ReconciliationRecord | undefined
}

export const useReconciliationStore = create<ReconciliationState>()(
  persist(
    (set, get) => ({
      records: [],

      importRecords: (
        data: Partial<ReconciliationRecord>[],
        strategy: ImportStrategy
      ): ImportResult => {
        const result: ImportResult = {
          added: 0,
          skipped: 0,
          updated: 0,
          conflicts: 0,
          total: data.length,
        }

        const now = new Date().toISOString()
        const existingRecords = [...get().records]

        const updatedRecords = [...existingRecords]

        for (const item of data) {
          const key = `${item.pharmacyName}|${item.flowNo}`
          const existingIndex = updatedRecords.findIndex(
            (r) => `${r.pharmacyName}|${r.flowNo}` === key
          )

          const autoVerdict = computeAutoVerdict({
            flowAmount: item.flowAmount ?? null,
            contractAmount: item.contractAmount ?? null,
            insuranceAmount: item.insuranceAmount ?? null,
          })

          const diffAmount = computeDiffAmount(
            item.flowAmount ?? null,
            item.contractAmount ?? null
          )

          if (existingIndex === -1) {
            const newRecord: ReconciliationRecord = {
              id: item.id || generateId(),
              pharmacyName: item.pharmacyName || '',
              flowNo: item.flowNo || '',
              flowAmount: item.flowAmount ?? null,
              contractAmount: item.contractAmount ?? null,
              insuranceAmount: item.insuranceAmount ?? null,
              diffAmount,
              status: autoVerdict,
              autoVerdict,
              manualVerdict: null,
              verdictReason: null,
              source: item.source || 'flow',
              createdAt: now,
              updatedAt: now,
              paymentFlows: (item.paymentFlows || []) as PaymentFlow[],
              refundRequests: (item.refundRequests || []) as RefundRequest[],
              approvalMails: (item.approvalMails || []) as ApprovalMail[],
              notes: (item.notes || []) as ManualNote[],
            }
            updatedRecords.push(newRecord)
            result.added++
          } else {
            if (strategy === 'skip') {
              result.skipped++
            } else if (strategy === 'update') {
              const existing = updatedRecords[existingIndex]
              updatedRecords[existingIndex] = {
                ...existing,
                flowAmount: item.flowAmount ?? existing.flowAmount,
                contractAmount:
                  item.contractAmount ?? existing.contractAmount,
                insuranceAmount:
                  item.insuranceAmount ?? existing.insuranceAmount,
                diffAmount: computeDiffAmount(
                  item.flowAmount ?? existing.flowAmount,
                  item.contractAmount ?? existing.contractAmount
                ),
                source: item.source || existing.source,
                updatedAt: now,
                paymentFlows:
                  (item.paymentFlows as PaymentFlow[]) ||
                  existing.paymentFlows,
                refundRequests:
                  (item.refundRequests as RefundRequest[]) ||
                  existing.refundRequests,
                approvalMails:
                  (item.approvalMails as ApprovalMail[]) ||
                  existing.approvalMails,
              }
              const newAutoVerdict = computeAutoVerdict({
                flowAmount: updatedRecords[existingIndex].flowAmount,
                contractAmount:
                  updatedRecords[existingIndex].contractAmount,
                insuranceAmount:
                  updatedRecords[existingIndex].insuranceAmount,
              })
              if (!existing.manualVerdict) {
                updatedRecords[existingIndex].status = newAutoVerdict
              }
              updatedRecords[existingIndex].autoVerdict = newAutoVerdict
              result.updated++
            } else if (strategy === 'conflict') {
              updatedRecords[existingIndex] = {
                ...updatedRecords[existingIndex],
                status: 'conflict',
                updatedAt: now,
              }
              result.conflicts++
            }
          }
        }

        set({ records: updatedRecords })
        return result
      },

      updateVerdict: (
        id: string,
        verdict: ReconciliationStatus,
        reason: string
      ) => {
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: verdict,
                  manualVerdict: verdict,
                  verdictReason: reason,
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
        }))
      },

      revertVerdict: (id: string) => {
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: r.autoVerdict,
                  manualVerdict: null,
                  verdictReason: null,
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
        }))
      },

      addNote: (id: string, content: string, author: string) => {
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id
              ? {
                  ...r,
                  notes: [
                    ...r.notes,
                    {
                      id: generateId(),
                      content,
                      author,
                      createdAt: new Date().toISOString(),
                    } as ManualNote,
                  ],
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
        }))
      },

      exportDiffReport: (): string => {
        const records = get().records.filter(
          (r) => r.status !== 'matched'
        )
        const csvData = records.map((r) => ({
          药房名称: r.pharmacyName,
          流水号: r.flowNo,
          流水金额: r.flowAmount ?? '',
          合同金额: r.contractAmount ?? '',
          医保金额: r.insuranceAmount ?? '',
          差异额: r.diffAmount ?? '',
          状态:
            r.status === 'overridden'
              ? `已改判(${r.manualVerdict})`
              : r.status,
          自动判定: r.autoVerdict,
          改判理由: r.verdictReason ?? '',
          来源: r.source,
          更新时间: r.updatedAt,
        }))

        return Papa.unparse(csvData, {
          header: true,
        })
      },

      clearAll: () => {
        set({ records: [] })
      },

      getRecordById: (id: string) => {
        return get().records.find((r) => r.id === id)
      },
    }),
    {
      name: 'reconciliation-store',
    }
  )
)
