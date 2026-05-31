import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  Receipt,
  ChangeRecord,
  ExportRecord,
  DailyReportRow,
  ImportPreview,
  ConsistencyResult,
  ReceiptStatus,
  TransactionField,
} from "@/types"
import { mockReceipts, mockChangeHistories, mockExportRecords } from "@/data/mockData"

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function nowISO(): string {
  return new Date().toISOString()
}

interface ReceiptStore {
  receipts: Receipt[]
  changeHistories: ChangeRecord[]
  exportRecords: ExportRecord[]
  initialized: boolean

  init: () => void
  importFromDailyReport: (data: DailyReportRow[]) => ImportPreview
  confirmImport: (preview: ImportPreview) => void
  updateTransactionField: (receiptId: string, txId: string, field: string, newValue: string) => void
  updateReceiptStatus: (receiptId: string, status: ReceiptStatus, remark?: string) => void
  releaseFrozen: (receiptId: string) => void
  getReceiptById: (id: string) => Receipt | undefined
  getChangeHistory: (receiptId: string) => ChangeRecord[]
  validateExportConsistency: (receiptIds: string[]) => ConsistencyResult
  exportChecklist: (receiptIds: string[]) => ExportRecord
  getFrozenReceipts: () => Receipt[]
}

export const useReceiptStore = create<ReceiptStore>()(
  persist(
    (set, get) => ({
      receipts: [],
      changeHistories: [],
      exportRecords: [],
      initialized: false,

      init: () => {
        const state = get()
        if (state.initialized && state.receipts.length > 0) return
        set({
          receipts: mockReceipts,
          changeHistories: mockChangeHistories,
          exportRecords: mockExportRecords,
          initialized: true,
        })
      },

      importFromDailyReport: (data: DailyReportRow[]): ImportPreview => {
        const { receipts } = get()
        const newRows: DailyReportRow[] = []
        const duplicateRows: DailyReportRow[] = []
        const errorRows: DailyReportRow[] = []

        for (const row of data) {
          if (!row.transactionNo || !row.channelName || !row.amount || row.amount <= 0) {
            errorRows.push(row)
            continue
          }
          const exists = receipts.some(
            (r) =>
              r.transactionNo === row.transactionNo &&
              r.channelName === row.channelName &&
              r.reportDate === row.reportDate
          )
          if (exists) {
            duplicateRows.push(row)
          } else {
            newRows.push(row)
          }
        }

        return { newRows, duplicateRows, errorRows }
      },

      confirmImport: (preview: ImportPreview) => {
        const newReceipts: Receipt[] = preview.newRows.map((row) => ({
          id: "R" + generateId(),
          channelName: row.channelName,
          transactionNo: row.transactionNo,
          amount: row.amount,
          status: "pending" as ReceiptStatus,
          frozenAmount: row.amount,
          frozenDays: 0,
          frozenReleased: false,
          createdAt: nowISO(),
          updatedAt: nowISO(),
          reportDate: row.reportDate,
          remark: row.remark || "",
          transactions: [
            {
              id: "TX" + generateId(),
              receiptId: "",
              fields: {
                账户名称: { value: row.channelName, originalValue: row.channelName, modified: false },
                返佣金额: { value: row.amount.toString(), originalValue: row.amount.toString(), modified: false },
                结算周期: { value: row.reportDate.slice(0, 7), originalValue: row.reportDate.slice(0, 7), modified: false },
              },
            },
          ],
          statusTimeline: [
            { status: "pending", timestamp: nowISO(), operator: "系统", remark: "复核日报导入" },
          ],
        }))

        newReceipts.forEach((r) => {
          r.transactions[0].receiptId = r.id
        })

        set((state) => ({
          receipts: [...state.receipts, ...newReceipts],
        }))
      },

      updateTransactionField: (receiptId: string, txId: string, field: string, newValue: string) => {
        const operator = "当前运营"
        const timestamp = nowISO()

        set((state) => {
          const receipt = state.receipts.find((r) => r.id === receiptId)
          if (!receipt) return state

          const tx = receipt.transactions.find((t) => t.id === txId)
          if (!tx) return state

          const fieldData = tx.fields[field]
          if (!fieldData) return state

          const changeRecord: ChangeRecord = {
            id: "CH" + generateId(),
            receiptId,
            transactionId: txId,
            fieldName: field,
            oldValue: fieldData.value,
            newValue,
            operator,
            timestamp,
          }

          const updatedField: TransactionField = {
            value: newValue,
            originalValue: fieldData.originalValue,
            modified: newValue !== fieldData.originalValue,
            modifiedAt: timestamp,
          }

          const updatedReceipts = state.receipts.map((r) => {
            if (r.id !== receiptId) return r
            return {
              ...r,
              updatedAt: timestamp,
              transactions: r.transactions.map((t) => {
                if (t.id !== txId) return t
                return {
                  ...t,
                  fields: { ...t.fields, [field]: updatedField },
                }
              }),
            }
          })

          return {
            receipts: updatedReceipts,
            changeHistories: [...state.changeHistories, changeRecord],
          }
        })
      },

      updateReceiptStatus: (receiptId: string, status: ReceiptStatus, remark?: string) => {
        const operator = "当前运营"
        const timestamp = nowISO()

        set((state) => {
          const updatedReceipts = state.receipts.map((r) => {
            if (r.id !== receiptId) return r
            return {
              ...r,
              status,
              updatedAt: timestamp,
              statusTimeline: [
                ...r.statusTimeline,
                { status, timestamp, operator, remark: remark || "" },
              ],
            }
          })

          return { receipts: updatedReceipts }
        })
      },

      releaseFrozen: (receiptId: string) => {
        const timestamp = nowISO()
        set((state) => {
          const updatedReceipts = state.receipts.map((r) => {
            if (r.id !== receiptId) return r
            return {
              ...r,
              frozenReleased: true,
              frozenAmount: 0,
              frozenDays: 0,
              updatedAt: timestamp,
            }
          })
          return { receipts: updatedReceipts }
        })
      },

      getReceiptById: (id: string) => {
        return get().receipts.find((r) => r.id === id)
      },

      getChangeHistory: (receiptId: string) => {
        return get().changeHistories.filter((c) => c.receiptId === receiptId)
      },

      validateExportConsistency: (receiptIds: string[]): ConsistencyResult => {
        const { receipts } = get()
        const differences: ConsistencyResult["differences"] = []

        for (const id of receiptIds) {
          const receipt = receipts.find((r) => r.id === id)
          if (!receipt) continue

          for (const tx of receipt.transactions) {
            for (const [fieldName, fieldData] of Object.entries(tx.fields)) {
              if (fieldData.value !== fieldData.originalValue) {
                differences.push({
                  receiptId: id,
                  receiptTransactionNo: receipt.transactionNo,
                  field: fieldName,
                  checklistValue: fieldData.originalValue,
                  detailValue: fieldData.value,
                })
              }
            }
          }
        }

        return {
          consistent: differences.length === 0,
          differences,
        }
      },

      exportChecklist: (receiptIds: string[]): ExportRecord => {
        const record: ExportRecord = {
          id: "EXP" + generateId(),
          timestamp: nowISO(),
          operator: "当前运营",
          receiptCount: receiptIds.length,
          receiptIds,
        }

        set((state) => ({
          exportRecords: [...state.exportRecords, record],
        }))

        return record
      },

      getFrozenReceipts: () => {
        return get().receipts.filter((r) => !r.frozenReleased && r.frozenAmount > 0)
      },
    }),
    {
      name: "commission-receipt-store",
    }
  )
)
