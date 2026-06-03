import { create } from "zustand"
import type { EvidenceRecord, AuditEntry, OperationLog, RecordStatus } from "@/types"
import { initialRecords, initialAuditEntries, initialOperationLogs } from "@/data/mockData"

interface EvidenceState {
  records: EvidenceRecord[]
  auditEntries: AuditEntry[]
  operationLogs: OperationLog[]
  activeFilter: RecordStatus | "all"
  setActiveFilter: (filter: RecordStatus | "all") => void
  importRecords: (data: Partial<EvidenceRecord>[]) => void
  reviewRecord: (id: string) => void
  supplementRecord: (id: string, correctedDate: string, note: string) => void
  manualCorrect: (id: string, field: string, oldValue: string, newValue: string) => void
  rerun: (id: string) => void
  getRecordById: (id: string) => EvidenceRecord | undefined
  getAuditEntriesByRecordId: (id: string) => AuditEntry[]
  getOperationLogsByRecordId: (id: string) => OperationLog[]
}

let nextId = 100

function generateId(prefix: string) {
  nextId += 1
  return `${prefix}-${String(nextId).padStart(3, "0")}`
}

export const useEvidenceStore = create<EvidenceState>((set, get) => ({
  records: [...initialRecords],
  auditEntries: [...initialAuditEntries],
  operationLogs: [...initialOperationLogs],
  activeFilter: "all",

  setActiveFilter: (filter) => set({ activeFilter: filter }),

  importRecords: (data) => {
    const newRecords: EvidenceRecord[] = data.map((d) => {
      const currencyType = d.amountHKD && d.amountCNY ? "MIXED" : d.amountCNY ? "CNY" : "HKD"
      const record: EvidenceRecord = {
        id: generateId("REC"),
        securityCode: d.securityCode || "00000.HK",
        securityName: d.securityName || "未知证券",
        amountHKD: d.amountHKD ?? null,
        amountCNY: d.amountCNY ?? null,
        currencyType: currencyType as EvidenceRecord["currencyType"],
        exDividendDate: d.exDividendDate || new Date().toISOString().slice(0, 10),
        correctedExDividendDate: null,
        status: currencyType === "MIXED" ? "pending_review" : "smooth",
        custodianConfirmRef: d.custodianConfirmRef || `CUST-${Date.now()}`,
        createdAt: new Date().toISOString(),
      }
      return record
    })

    const newAuditEntries: AuditEntry[] = []
    const newLogs: OperationLog[] = []

    newRecords.forEach((record) => {
      newAuditEntries.push({
        id: generateId("AUD"),
        recordId: record.id,
        fieldName: "全量导入",
        oldValue: "-",
        newValue: `${record.securityName} / ${record.currencyType === "MIXED" ? `HKD ${record.amountHKD} + CNY ${record.amountCNY}` : `${record.currencyType} ${record.amountHKD || record.amountCNY}`} / 除权日 ${record.exDividendDate}`,
        changeType: "import",
        operator: "投研助理小周",
        timestamp: record.createdAt,
      })

      if (record.status === "smooth") {
        newAuditEntries.push({
          id: generateId("AUD"),
          recordId: record.id,
          fieldName: "状态",
          oldValue: "导入",
          newValue: "顺利归档",
          changeType: "auto_archive",
          operator: "系统",
          timestamp: new Date(Date.parse(record.createdAt) + 60000).toISOString(),
        })
        newLogs.push({
          id: generateId("LOG"),
          recordId: record.id,
          action: "自动归档",
          operator: "系统",
          detail: "记录顺利，自动归档完成",
          timestamp: new Date(Date.parse(record.createdAt) + 60000).toISOString(),
        })
      } else if (record.status === "pending_review") {
        newAuditEntries.push({
          id: generateId("AUD"),
          recordId: record.id,
          fieldName: "状态",
          oldValue: "导入",
          newValue: "待复核（港币/人民币同列）",
          changeType: "flag_review",
          operator: "系统",
          timestamp: new Date(Date.parse(record.createdAt) + 60000).toISOString(),
        })
        newLogs.push({
          id: generateId("LOG"),
          recordId: record.id,
          action: "标记待复核",
          operator: "系统",
          detail: "币种异常（港币+人民币同列），转交托管对接人复核",
          timestamp: new Date(Date.parse(record.createdAt) + 60000).toISOString(),
        })
      }

      newLogs.push({
        id: generateId("LOG"),
        recordId: record.id,
        action: "导入托管确认页",
        operator: "投研助理小周",
        detail: `首次导入${record.securityName} (${record.securityCode})，币种${record.currencyType === "MIXED" ? "港币+人民币同列" : record.currencyType}`,
        timestamp: record.createdAt,
      })
    })

    set((state) => ({
      records: [...state.records, ...newRecords],
      auditEntries: [...state.auditEntries, ...newAuditEntries],
      operationLogs: [...state.operationLogs, ...newLogs],
    }))
  },

  reviewRecord: (id) => {
    const record = get().records.find((r) => r.id === id)
    if (!record || record.status !== "pending_review") return

    const now = new Date().toISOString()
    const newAudit: AuditEntry = {
      id: generateId("AUD"),
      recordId: id,
      fieldName: "状态",
      oldValue: "待复核",
      newValue: "复核通过",
      changeType: "review_approve",
      operator: "托管对接人李姐",
      timestamp: now,
    }
    const newLog: OperationLog = {
      id: generateId("LOG"),
      recordId: id,
      action: "复核通过",
      operator: "托管对接人李姐",
      detail: `确认港币金额 ${record.amountHKD?.toLocaleString()}，人民币金额 ${record.amountCNY?.toLocaleString()}，数据无误`,
      timestamp: now,
    }

    set((state) => ({
      records: state.records.map((r) =>
        r.id === id ? { ...r, status: "reviewed" as RecordStatus } : r
      ),
      auditEntries: [...state.auditEntries, newAudit],
      operationLogs: [...state.operationLogs, newLog],
    }))
  },

  supplementRecord: (id, correctedDate, note) => {
    const record = get().records.find((r) => r.id === id)
    if (!record) return

    const now = new Date().toISOString()
    const newAudit: AuditEntry = {
      id: generateId("AUD"),
      recordId: id,
      fieldName: "除权日",
      oldValue: record.exDividendDate,
      newValue: correctedDate,
      changeType: "supplement",
      operator: "投研助理小周",
      timestamp: now,
    }
    const newLog: OperationLog = {
      id: generateId("LOG"),
      recordId: id,
      action: "上传除权日截图",
      operator: "投研助理小周",
      detail: note || `发现除权日为 ${correctedDate}，非原口径 ${record.exDividendDate}`,
      timestamp: now,
    }

    set((state) => ({
      records: state.records.map((r) =>
        r.id === id ? { ...r, correctedExDividendDate: correctedDate } : r
      ),
      auditEntries: [...state.auditEntries, newAudit],
      operationLogs: [...state.operationLogs, newLog],
    }))
  },

  manualCorrect: (id, field, oldValue, newValue) => {
    const now = new Date().toISOString()
    const newAudit: AuditEntry = {
      id: generateId("AUD"),
      recordId: id,
      fieldName: field,
      oldValue,
      newValue,
      changeType: "manual_correction",
      operator: "投研助理小周",
      timestamp: now,
    }
    const newLog: OperationLog = {
      id: generateId("LOG"),
      recordId: id,
      action: "人工修正",
      operator: "投研助理小周",
      detail: `${field} 从 ${oldValue} 修正为 ${newValue}`,
      timestamp: now,
    }

    set((state) => ({
      records: state.records.map((r) => {
        if (r.id !== id) return r
        if (field === "除权日") {
          return { ...r, correctedExDividendDate: newValue }
        }
        return r
      }),
      auditEntries: [...state.auditEntries, newAudit],
      operationLogs: [...state.operationLogs, newLog],
    }))
  },

  rerun: (id) => {
    const record = get().records.find((r) => r.id === id)
    if (!record) return

    const now = new Date().toISOString()
    const newAudit: AuditEntry = {
      id: generateId("AUD"),
      recordId: id,
      fieldName: "状态",
      oldValue: "待补录",
      newValue: "已补录（重跑完成）",
      changeType: "rerun",
      operator: "系统",
      timestamp: now,
    }
    const newLog: OperationLog = {
      id: generateId("LOG"),
      recordId: id,
      action: "重跑",
      operator: "系统",
      detail: "按修正后除权日重新计算，审计明细已更新",
      timestamp: now,
    }

    set((state) => ({
      records: state.records.map((r) =>
        r.id === id ? { ...r, status: "supplemented" as RecordStatus } : r
      ),
      auditEntries: [...state.auditEntries, newAudit],
      operationLogs: [...state.operationLogs, newLog],
    }))
  },

  getRecordById: (id) => get().records.find((r) => r.id === id),

  getAuditEntriesByRecordId: (id) =>
    get().auditEntries.filter((a) => a.recordId === id),

  getOperationLogsByRecordId: (id) =>
    get().operationLogs.filter((l) => l.recordId === id),
}))
