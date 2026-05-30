import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Receipt, Invoice, FeeAllocation, AuditLog, Anomaly } from '@/types'

interface AppState {
  receipts: Receipt[]
  invoices: Invoice[]
  feeAllocations: FeeAllocation[]
  auditLogs: AuditLog[]
  anomalies: Anomaly[]
  currentOperator: string
  
  addReceipt: (receipt: Omit<Receipt, 'id' | 'createdAt'>) => void
  updateReceipt: (id: string, updates: Partial<Receipt>) => void
  deleteReceipt: (id: string) => void
  
  addInvoice: (invoice: Omit<Invoice, 'id'>) => void
  updateInvoice: (id: string, updates: Partial<Invoice>) => void
  linkInvoiceToReceipt: (invoiceId: string, receiptId: string) => void
  
  addFeeAllocation: (allocation: Omit<FeeAllocation, 'id' | 'createdAt'>) => void
  clearAllocationsForReceipt: (receiptId: string) => void
  
  addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => void
  
  addAnomaly: (anomaly: Omit<Anomaly, 'id'>) => void
  resolveAnomaly: (anomalyId: string, resolvedBy: string) => void
  
  getReceiptInvoices: (receiptId: string) => Invoice[]
  getReceiptAllocations: (receiptId: string) => FeeAllocation[]
  getReceiptAnomalies: (receiptId: string) => Anomaly[]
  getReceiptAuditLogs: (receiptId: string) => AuditLog[]
  
  importData: (data: Partial<AppState>) => void
  resetAllData: () => void
}

const initialReceipts: Receipt[] = []
const initialInvoices: Invoice[] = []
const initialAllocations: FeeAllocation[] = []
const initialAuditLogs: AuditLog[] = []
const initialAnomalies: Anomaly[] = []

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      receipts: initialReceipts,
      invoices: initialInvoices,
      feeAllocations: initialAllocations,
      auditLogs: initialAuditLogs,
      anomalies: initialAnomalies,
      currentOperator: '财务人员',

      addReceipt: (receipt) => {
        const newReceipt: Receipt = {
          ...receipt,
          id: Date.now().toString(),
          createdAt: new Date().toISOString()
        }
        set((state) => ({
          receipts: [...state.receipts, newReceipt]
        }))
        get().addAuditLog({
          receiptId: newReceipt.id,
          action: 'create',
          operator: get().currentOperator,
          remark: '创建收款流水'
        })
      },

      updateReceipt: (id, updates) => {
        const before = get().receipts.find(r => r.id === id)
        set((state) => ({
          receipts: state.receipts.map(r =>
            r.id === id ? { ...r, ...updates } : r
          )
        }))
        get().addAuditLog({
          receiptId: id,
          action: 'update',
          operator: get().currentOperator,
          beforeValue: JSON.stringify(before),
          afterValue: JSON.stringify({ ...before, ...updates }),
          remark: '更新收款流水'
        })
      },

      deleteReceipt: (id) => {
        set((state) => ({
          receipts: state.receipts.filter(r => r.id !== id),
          invoices: state.invoices.map(i =>
            i.receiptId === id ? { ...i, receiptId: undefined } : i
          ),
          feeAllocations: state.feeAllocations.filter(a => a.receiptId !== id),
          anomalies: state.anomalies.filter(a => a.receiptId !== id)
        }))
      },

      addInvoice: (invoice) => {
        const newInvoice: Invoice = {
          ...invoice,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
        }
        set((state) => ({
          invoices: [...state.invoices, newInvoice]
        }))
      },

      updateInvoice: (id, updates) => {
        set((state) => ({
          invoices: state.invoices.map(i =>
            i.id === id ? { ...i, ...updates } : i
          )
        }))
      },

      linkInvoiceToReceipt: (invoiceId, receiptId) => {
        set((state) => ({
          invoices: state.invoices.map(i =>
            i.id === invoiceId ? { ...i, receiptId } : i
          )
        }))
      },

      addFeeAllocation: (allocation) => {
        const newAllocation: FeeAllocation = {
          ...allocation,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString()
        }
        set((state) => ({
          feeAllocations: [...state.feeAllocations, newAllocation]
        }))
      },

      clearAllocationsForReceipt: (receiptId) => {
        set((state) => ({
          feeAllocations: state.feeAllocations.filter(a => a.receiptId !== receiptId)
        }))
      },

      addAuditLog: (log) => {
        const newLog: AuditLog = {
          ...log,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString()
        }
        set((state) => ({
          auditLogs: [...state.auditLogs, newLog]
        }))
      },

      addAnomaly: (anomaly) => {
        const newAnomaly: Anomaly = {
          ...anomaly,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
        }
        set((state) => ({
          anomalies: [...state.anomalies, newAnomaly]
        }))
      },

      resolveAnomaly: (anomalyId, resolvedBy) => {
        set((state) => ({
          anomalies: state.anomalies.map(a =>
            a.id === anomalyId ? {
              ...a,
              resolved: true,
              resolvedBy,
              resolvedAt: new Date().toISOString()
            } : a
          )
        }))
      },

      getReceiptInvoices: (receiptId) => {
        return get().invoices.filter(i => i.receiptId === receiptId)
      },

      getReceiptAllocations: (receiptId) => {
        return get().feeAllocations.filter(a => a.receiptId === receiptId)
      },

      getReceiptAnomalies: (receiptId) => {
        return get().anomalies.filter(a => a.receiptId === receiptId)
      },

      getReceiptAuditLogs: (receiptId) => {
        return get().auditLogs.filter(l => l.receiptId === receiptId)
      },

      importData: (data) => {
        set((state) => ({
          ...state,
          ...data
        }))
      },

      resetAllData: () => {
        set({
          receipts: initialReceipts,
          invoices: initialInvoices,
          feeAllocations: initialAllocations,
          auditLogs: initialAuditLogs,
          anomalies: initialAnomalies
        })
      }
    }),
    {
      name: 'fee-allocation-storage'
    }
  )
)
