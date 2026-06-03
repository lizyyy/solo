import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ReviewRecord, AuditEntry, RecordStatus, ApproverType } from "@/types"

function detectApproverType(approver: string): ApproverType {
  return /^[a-zA-Z]/.test(approver.trim()) ? "pinyin" : "full"
}

function determineStatus(approverType: ApproverType, tailNumber: string): RecordStatus {
  if (approverType === "pinyin") return "pending_review"
  if (!tailNumber) return "pending_supplement"
  return "normal"
}

function makeAuditEntry(
  action: AuditEntry["action"],
  step: string,
  operator: string,
  detail: string,
  beforeValue?: string | number | null,
  afterValue?: string | number | null
): AuditEntry {
  return {
    id: `ae-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    step,
    operator,
    timestamp: new Date().toLocaleString("zh-CN"),
    action,
    detail,
    beforeValue: beforeValue ?? undefined,
    afterValue: afterValue ?? undefined,
  }
}

const DEMO_RECORDS: ReviewRecord[] = [
  {
    id: "rec-001",
    date: "2025-05-10",
    counterNo: "A03",
    tailNumber: "8842",
    taxRateRemark: "增值税6%—柜台缴税正常",
    approver: "张明",
    approverType: "full",
    status: "normal",
    balanceBefore: 152340.5,
    balanceAfter: 152340.5,
    balanceDiff: 0,
    correctionAmount: null,
    correctionReason: null,
    auditTrail: [
      {
        id: "ae-001-1",
        step: "税费率备注导入",
        operator: "阿芬",
        timestamp: "2025-05-10 09:15:00",
        action: "import",
        detail: "导入税费率备注，审批人：张明（完整中文），识别为正常",
      },
      {
        id: "ae-001-2",
        step: "柜台流水尾号补录",
        operator: "阿芬",
        timestamp: "2025-05-10 09:22:00",
        action: "supplement",
        detail: "补录柜台流水尾号 8842",
        beforeValue: "",
        afterValue: "8842",
      },
      {
        id: "ae-001-3",
        step: "余额变化表更新",
        operator: "系统",
        timestamp: "2025-05-10 09:22:01",
        action: "rerun",
        detail: "余额无差异，复盘完成",
        beforeValue: 152340.5,
        afterValue: 152340.5,
      },
    ],
  },
  {
    id: "rec-002",
    date: "2025-05-12",
    counterNo: "B07",
    tailNumber: "3319",
    taxRateRemark: "印花税0.05%—审批人只留拼音",
    approver: "ZhangSan",
    approverType: "pinyin",
    status: "pending_review",
    balanceBefore: 87520.0,
    balanceAfter: 87480.0,
    balanceDiff: -40.0,
    correctionAmount: null,
    correctionReason: null,
    auditTrail: [
      {
        id: "ae-002-1",
        step: "税费率备注导入",
        operator: "阿芬",
        timestamp: "2025-05-12 10:30:00",
        action: "import",
        detail: "导入税费率备注，审批人：ZhangSan（仅拼音），标记为待复核，不急于归正常",
      },
      {
        id: "ae-002-2",
        step: "柜台流水尾号补录",
        operator: "阿芬",
        timestamp: "2025-05-12 10:35:00",
        action: "supplement",
        detail: "补录柜台流水尾号 3319",
        beforeValue: "",
        afterValue: "3319",
      },
      {
        id: "ae-002-3",
        step: "余额变化表更新",
        operator: "系统",
        timestamp: "2025-05-12 10:35:01",
        action: "rerun",
        detail: "余额差异 -40.00元，因审批人仅拼音，留待客户经理复核",
        beforeValue: 87520.0,
        afterValue: 87480.0,
      },
    ],
  },
  {
    id: "rec-003",
    date: "2025-04-28",
    counterNo: "C12",
    tailNumber: "5576",
    taxRateRemark: "城建税7%—旧口径后期补录",
    approver: "李芳",
    approverType: "full",
    status: "normal",
    balanceBefore: 213680.75,
    balanceAfter: 213650.75,
    balanceDiff: -30.0,
    correctionAmount: 30.0,
    correctionReason: "旧口径税费率差异，柜台流水尾号补录后发现短款30元",
    auditTrail: [
      {
        id: "ae-003-1",
        step: "税费率备注导入",
        operator: "阿芬",
        timestamp: "2025-04-28 14:00:00",
        action: "import",
        detail: "导入税费率备注（旧口径），审批人：李芳（完整中文），但缺少柜台流水尾号",
      },
      {
        id: "ae-003-2",
        step: "余额变化表初始",
        operator: "系统",
        timestamp: "2025-04-28 14:00:01",
        action: "rerun",
        detail: "无流水尾号，余额变化表无法计算，标记为待补录",
        beforeValue: 213680.75,
        afterValue: null,
      },
      {
        id: "ae-003-3",
        step: "柜台流水尾号补录（旧口径来源）",
        operator: "阿芬",
        timestamp: "2025-05-05 11:20:00",
        action: "supplement",
        detail: "从旧系统补录柜台流水尾号 5576",
        beforeValue: "",
        afterValue: "5576",
      },
      {
        id: "ae-003-4",
        step: "余额变化表更新",
        operator: "系统",
        timestamp: "2025-05-05 11:20:01",
        action: "rerun",
        detail: "补录尾号后重算余额，发现短款30元",
        beforeValue: 213680.75,
        afterValue: 213650.75,
      },
      {
        id: "ae-003-5",
        step: "人工修正",
        operator: "阿芬",
        timestamp: "2025-05-05 11:25:00",
        action: "correct",
        detail: "人工修正：旧口径税费率差异，柜台流水尾号补录后发现短款30元",
        beforeValue: null,
        afterValue: 30.0,
      },
      {
        id: "ae-003-6",
        step: "重跑余额变化表",
        operator: "系统",
        timestamp: "2025-05-05 11:25:01",
        action: "rerun",
        detail: "修正后重跑，余额变化表更新完成，复盘归正常",
        beforeValue: 213650.75,
        afterValue: 213680.75,
      },
    ],
  },
]

interface ReviewStore {
  records: ReviewRecord[]
  loadDemoData: () => void
  addRecord: (data: {
    date: string
    counterNo: string
    tailNumber: string
    taxRateRemark: string
    approver: string
    balanceBefore: number
  }) => void
  supplementTailNumber: (id: string, tailNumber: string) => void
  applyCorrection: (id: string, amount: number, reason: string) => void
  rerunBalance: (id: string) => void
  reviewApprove: (id: string) => void
  reviewReject: (id: string) => void
  getRecord: (id: string) => ReviewRecord | undefined
  resetToDemo: () => void
}

export const useReviewStore = create<ReviewStore>()(
  persist(
    (set, get) => ({
      records: [],

      loadDemoData: () => {
        set({ records: DEMO_RECORDS })
      },

      addRecord: (data) => {
        const approverType = detectApproverType(data.approver)
        const status = determineStatus(approverType, data.tailNumber)
        const newRecord: ReviewRecord = {
          id: `rec-${Date.now()}`,
          date: data.date,
          counterNo: data.counterNo,
          tailNumber: data.tailNumber,
          taxRateRemark: data.taxRateRemark,
          approver: data.approver,
          approverType,
          status,
          balanceBefore: data.balanceBefore,
          balanceAfter: data.tailNumber ? data.balanceBefore : null,
          balanceDiff: data.tailNumber ? 0 : null,
          correctionAmount: null,
          correctionReason: null,
          auditTrail: [
            makeAuditEntry(
              "import",
              "税费率备注导入",
              "阿芬",
              `导入税费率备注，审批人：${data.approver}（${approverType === "pinyin" ? "仅拼音" : "完整中文"}），${approverType === "pinyin" ? "标记为待复核，不急于归正常" : "识别为正常"}`
            ),
          ],
        }
        if (data.tailNumber) {
          newRecord.auditTrail.push(
            makeAuditEntry(
              "supplement",
              "柜台流水尾号补录",
              "阿芬",
              `补录柜台流水尾号 ${data.tailNumber}`,
              "",
              data.tailNumber
            )
          )
        }
        set((state) => ({ records: [...state.records, newRecord] }))
      },

      supplementTailNumber: (id, tailNumber) => {
        set((state) => ({
          records: state.records.map((r) => {
            if (r.id !== id) return r
            const oldTailNumber = r.tailNumber
            const newBalanceAfter = r.balanceBefore
            const newBalanceDiff = newBalanceAfter - r.balanceBefore
            const newStatus: RecordStatus =
              r.approverType === "pinyin" ? "pending_review" : "normal"
            return {
              ...r,
              tailNumber,
              balanceAfter: newBalanceAfter,
              balanceDiff: newBalanceDiff,
              status: newStatus,
              auditTrail: [
                ...r.auditTrail,
                makeAuditEntry(
                  "supplement",
                  "柜台流水尾号补录",
                  "阿芬",
                  `补录柜台流水尾号 ${tailNumber}`,
                  oldTailNumber || "",
                  tailNumber
                ),
                makeAuditEntry(
                  "rerun",
                  "余额变化表更新",
                  "系统",
                  `补录尾号后重算余额，差异：${newBalanceDiff.toFixed(2)}元`,
                  r.balanceAfter,
                  newBalanceAfter
                ),
              ],
            }
          }),
        }))
      },

      applyCorrection: (id, amount, reason) => {
        set((state) => ({
          records: state.records.map((r) => {
            if (r.id !== id) return r
            const oldCorrection = r.correctionAmount
            return {
              ...r,
              correctionAmount: amount,
              correctionReason: reason,
              auditTrail: [
                ...r.auditTrail,
                makeAuditEntry(
                  "correct",
                  "人工修正",
                  "阿芬",
                  `人工修正：${reason}`,
                  oldCorrection,
                  amount
                ),
              ],
            }
          }),
        }))
      },

      rerunBalance: (id) => {
        set((state) => ({
          records: state.records.map((r) => {
            if (r.id !== id) return r
            if (r.correctionAmount === null) return r
            const newBalanceAfter = (r.balanceAfter ?? r.balanceBefore) + r.correctionAmount
            const newBalanceDiff = newBalanceAfter - r.balanceBefore
            const newStatus: RecordStatus =
              r.approverType === "pinyin" ? "pending_review" : "normal"
            return {
              ...r,
              balanceAfter: newBalanceAfter,
              balanceDiff: newBalanceDiff,
              status: newStatus,
              auditTrail: [
                ...r.auditTrail,
                makeAuditEntry(
                  "rerun",
                  "重跑余额变化表",
                  "系统",
                  `修正后重跑，余额变化表更新完成${newStatus === "normal" ? "，复盘归正常" : "，审批人仍为拼音，留待客户经理复核"}`,
                  r.balanceAfter,
                  newBalanceAfter
                ),
              ],
            }
          }),
        }))
      },

      reviewApprove: (id) => {
        set((state) => ({
          records: state.records.map((r) => {
            if (r.id !== id) return r
            return {
              ...r,
              status: "normal" as RecordStatus,
              approverType: "full" as ApproverType,
              auditTrail: [
                ...r.auditTrail,
                makeAuditEntry(
                  "review",
                  "客户经理复核",
                  "客户经理",
                  `客户经理确认审批人"${r.approver}"拼音对应实名，复核通过`
                ),
              ],
            }
          }),
        }))
      },

      reviewReject: (id) => {
        set((state) => ({
          records: state.records.map((r) => {
            if (r.id !== id) return r
            return {
              ...r,
              auditTrail: [
                ...r.auditTrail,
                makeAuditEntry(
                  "review_reject",
                  "客户经理复核",
                  "客户经理",
                  `客户经理驳回审批人"${r.approver}"拼音，需退回修正`
                ),
              ],
            }
          }),
        }))
      },

      getRecord: (id) => {
        return get().records.find((r) => r.id === id)
      },

      resetToDemo: () => {
        set({ records: DEMO_RECORDS })
      },
    }),
    {
      name: "review-store",
    }
  )
)
