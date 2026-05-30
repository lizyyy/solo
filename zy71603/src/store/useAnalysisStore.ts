import { create } from "zustand"
import type { AnalysisResult, DetailCategory, DetailItem, AnomalyRecord } from "@/engine/types"
import { sampleData } from "@/data/sampleData"
import { runFullAnalysis } from "@/engine/analyzer"

interface AnalysisState {
  result: AnalysisResult | null
  detailCategory: DetailCategory | null
  detailItems: DetailItem[]
  detailTitle: string
  selectedAnomaly: AnomalyRecord | null

  runAnalysis: () => void
  openDetail: (category: DetailCategory, title: string) => void
  closeDetail: () => void
  selectAnomaly: (anomaly: AnomalyRecord | null) => void
}

function buildDetailItems(category: DetailCategory, result: AnalysisResult): DetailItem[] {
  switch (category) {
    case "creditor_normal":
      return result.creditorCheck.details.normal.map((inv) => ({
        id: inv.id,
        label: inv.invoiceNo,
        value: `¥${inv.amount.toLocaleString("zh-CN")}`,
        severity: "normal" as const,
        invoiceNo: inv.invoiceNo,
        amount: inv.amount,
        seller: inv.seller,
        buyer: inv.buyer,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
      }))
    case "creditor_duplicate":
      return result.creditorCheck.details.duplicate.map((inv) => ({
        id: inv.id,
        label: inv.invoiceNo,
        value: `¥${inv.amount.toLocaleString("zh-CN")}`,
        severity: "error" as const,
        invoiceNo: inv.invoiceNo,
        amount: inv.amount,
        seller: inv.seller,
        buyer: inv.buyer,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
      }))
    case "creditor_amount_mismatch":
      return result.creditorCheck.details.amountMismatch.map((inv) => ({
        id: inv.id,
        label: inv.invoiceNo,
        value: `¥${inv.amount.toLocaleString("zh-CN")}`,
        severity: "warning" as const,
        invoiceNo: inv.invoiceNo,
        amount: inv.amount,
        originalAmount: inv.originalAmount,
        seller: inv.seller,
        buyer: inv.buyer,
        note: inv.manualCorrectionNote,
      }))
    case "confirm_confirmed":
      return result.confirmStatus.details.confirmed.map((c) => ({
        id: c.id,
        label: c.transferNo,
        value: `¥${c.confirmedAmount.toLocaleString("zh-CN")}`,
        severity: "normal" as const,
        transferNo: c.transferNo,
        confirmedAmount: c.confirmedAmount,
        confirmDate: c.confirmDate,
      }))
    case "confirm_unconfirmed":
      return result.confirmStatus.details.unconfirmed.map((c) => ({
        id: c.id,
        label: c.transferNo,
        value: "未确认",
        severity: "error" as const,
        transferNo: c.transferNo,
        confirmedAmount: c.confirmedAmount,
      }))
    case "confirm_partial":
      return result.confirmStatus.details.partial.map((c) => ({
        id: c.id,
        label: c.transferNo,
        value: `¥${c.confirmedAmount.toLocaleString("zh-CN")}`,
        severity: "warning" as const,
        transferNo: c.transferNo,
        confirmedAmount: c.confirmedAmount,
        confirmDate: c.confirmDate,
      }))
    case "repayment_matched":
      return result.repaymentMatch.details.matched.map((r) => ({
        id: r.id,
        label: r.flowNo,
        value: `¥${r.amount.toLocaleString("zh-CN")}`,
        severity: "normal" as const,
        flowNo: r.flowNo,
        invoiceNo: r.invoiceNo,
        amount: r.amount,
        repayDate: r.repayDate,
      }))
    case "repayment_unmatched":
      return result.repaymentMatch.details.unmatched.map((r) => ({
        id: r.id,
        label: r.flowNo,
        value: `¥${r.amount.toLocaleString("zh-CN")}`,
        severity: "warning" as const,
        flowNo: r.flowNo,
        invoiceNo: r.invoiceNo,
        amount: r.amount,
        repayDate: r.repayDate,
      }))
    case "repayment_mismatched":
      return result.repaymentMatch.details.mismatched.map((r) => ({
        id: r.id,
        label: r.flowNo,
        value: `¥${r.amount.toLocaleString("zh-CN")}`,
        severity: "error" as const,
        flowNo: r.flowNo,
        invoiceNo: r.invoiceNo,
        amount: r.amount,
        repayDate: r.repayDate,
        mismatchType: r.mismatchType,
      }))
    case "anomaly":
      return result.anomalies.map((a) => ({
        id: a.id,
        label: a.category,
        value: a.severity === "error" ? "严重" : a.severity === "warning" ? "警告" : "提示",
        severity: a.severity === "error" ? "error" : a.severity === "warning" ? "warning" : "normal",
        description: a.description,
        impact: a.impact,
        step: a.stepLabel,
      }))
    default:
      return []
  }
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  result: null,
  detailCategory: null,
  detailItems: [],
  detailTitle: "",
  selectedAnomaly: null,

  runAnalysis: () => {
    const result = runFullAnalysis(
      sampleData.invoices,
      sampleData.transferApplications,
      sampleData.buyerConfirmations,
      sampleData.repaymentFlows
    )
    set({ result })
  },

  openDetail: (category: DetailCategory, title: string) => {
    const { result } = get()
    if (!result) return
    const items = buildDetailItems(category, result)
    set({ detailCategory: category, detailItems: items, detailTitle: title })
  },

  closeDetail: () => {
    set({ detailCategory: null, detailItems: [], detailTitle: "" })
  },

  selectAnomaly: (anomaly: AnomalyRecord | null) => {
    set({ selectedAnomaly: anomaly })
  },
}))
