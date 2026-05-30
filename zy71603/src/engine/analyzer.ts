import type {
  Invoice,
  TransferApplication,
  BuyerConfirmation,
  RepaymentFlow,
  AnomalyRecord,
  AnalysisResult,
  CreditorCheckResult,
  ConfirmStatusResult,
  RepaymentMatchResult,
} from "./types"

let anomalyCounter = 0

function makeAnomalyId(): string {
  anomalyCounter += 1
  return `anomaly-${String(anomalyCounter).padStart(3, "0")}`
}

function formatAmount(n: number): string {
  return `¥${n.toLocaleString("zh-CN")}`
}

export function runCreditorCheck(
  invoices: Invoice[],
  transfers: TransferApplication[]
): { result: CreditorCheckResult; anomalies: AnomalyRecord[] } {
  const anomalies: AnomalyRecord[] = []
  const invoiceTransferMap = new Map<string, string[]>()

  for (const t of transfers) {
    for (const invId of t.invoiceIds) {
      const existing = invoiceTransferMap.get(invId) || []
      existing.push(t.transferNo)
      invoiceTransferMap.set(invId, existing)
    }
  }

  const normalInvoices: Invoice[] = []
  const duplicateInvoices: Invoice[] = []
  const amountMismatchInvoices: Invoice[] = []

  for (const inv of invoices) {
    const transferNos = invoiceTransferMap.get(inv.id) || []
    if (transferNos.length > 1) {
      duplicateInvoices.push(inv)
      anomalies.push({
        id: makeAnomalyId(),
        step: "creditor_check",
        stepLabel: "债权校验",
        category: "发票重复转让",
        severity: "error",
        sourceId: inv.id,
        sourceType: "invoice",
        description: `发票 ${inv.invoiceNo} 同时出现在 ${transferNos.join("、")} 中，属于重复转让`,
        impact: `重复转让金额 ${formatAmount(inv.amount)}，可能导致同一笔债权被两次融资`,
        timestamp: new Date().toISOString(),
        detail: { invoiceNo: inv.invoiceNo, amount: inv.amount, transferNos },
      })
    } else if (inv.manualCorrection) {
      amountMismatchInvoices.push(inv)
      anomalies.push({
        id: makeAnomalyId(),
        step: "creditor_check",
        stepLabel: "债权校验",
        category: "手工更正",
        severity: "warning",
        sourceId: inv.id,
        sourceType: "invoice",
        description: `发票 ${inv.invoiceNo} 存在手工更正：${inv.manualCorrectionNote || ""}`,
        impact: `原始金额 ${formatAmount(inv.originalAmount || 0)} 被修改为 ${formatAmount(inv.amount)}，差额 ${formatAmount(inv.amount - (inv.originalAmount || 0))}，无变更审批记录`,
        timestamp: new Date().toISOString(),
        detail: {
          invoiceNo: inv.invoiceNo,
          originalAmount: inv.originalAmount,
          correctedAmount: inv.amount,
          note: inv.manualCorrectionNote,
        },
      })
    } else {
      normalInvoices.push(inv)
    }
  }

  for (const t of transfers) {
    if (!t.hasContract) {
      anomalies.push({
        id: makeAnomalyId(),
        step: "creditor_check",
        stepLabel: "债权校验",
        category: "材料缺项",
        severity: "warning",
        sourceId: t.id,
        sourceType: "transfer",
        description: `转让申请 ${t.transferNo} 缺少合同附件`,
        impact: "合同是债权成立的基础凭证，缺失将影响债权有效性认定",
        timestamp: new Date().toISOString(),
        detail: { transferNo: t.transferNo, missingItem: "合同附件" },
      })
    }
    if (!t.hasVerificationReport) {
      anomalies.push({
        id: makeAnomalyId(),
        step: "creditor_check",
        stepLabel: "债权校验",
        category: "材料缺项",
        severity: "warning",
        sourceId: t.id,
        sourceType: "transfer",
        description: `转让申请 ${t.transferNo} 缺少核验报告`,
        impact: "核验报告是确认债权真实性的关键材料，缺失可能影响后续审计",
        timestamp: new Date().toISOString(),
        detail: { transferNo: t.transferNo, missingItem: "核验报告" },
      })
    }
    if (t.verificationManualCorrected) {
      anomalies.push({
        id: makeAnomalyId(),
        step: "creditor_check",
        stepLabel: "债权校验",
        category: "核验报告手工更正",
        severity: "warning",
        sourceId: t.id,
        sourceType: "transfer",
        description: `转让申请 ${t.transferNo} 的核验报告存在手工更正`,
        impact: "核验报告手工修改未经审批，可能影响报告的法律效力",
        timestamp: new Date().toISOString(),
        detail: { transferNo: t.transferNo, verificationAmount: t.verificationAmount },
      })
    }

    const invoiceTotal = t.invoiceIds
      .map((id) => invoices.find((i) => i.id === id))
      .filter(Boolean)
      .reduce((sum, inv) => sum + (inv?.amount || 0), 0)
    if (Math.abs(invoiceTotal - t.totalAmount) > 0.01) {
      const diff = t.totalAmount - invoiceTotal
      anomalies.push({
        id: makeAnomalyId(),
        step: "creditor_check",
        stepLabel: "债权校验",
        category: "金额不一致",
        severity: "error",
        sourceId: t.id,
        sourceType: "transfer",
        description: `转让申请 ${t.transferNo} 声明总额 ${formatAmount(t.totalAmount)} 与发票合计 ${formatAmount(invoiceTotal)} 不符，差额 ${formatAmount(Math.abs(diff))}`,
        impact: `${diff > 0 ? "转让金额多出" : "转让金额少计"} ${formatAmount(Math.abs(diff))}，可能存在虚增或遗漏`,
        timestamp: new Date().toISOString(),
        detail: { transferNo: t.transferNo, declaredAmount: t.totalAmount, invoiceTotal, diff },
      })
    }
  }

  return {
    result: {
      normal: normalInvoices.length,
      duplicate: duplicateInvoices.length,
      amountMismatch: amountMismatchInvoices.length,
      details: {
        normal: normalInvoices,
        duplicate: duplicateInvoices,
        amountMismatch: amountMismatchInvoices,
      },
    },
    anomalies,
  }
}

export function runConfirmStatusCheck(
  transfers: TransferApplication[],
  confirmations: BuyerConfirmation[],
  invoices: Invoice[]
): { result: ConfirmStatusResult; anomalies: AnomalyRecord[] } {
  const anomalies: AnomalyRecord[] = []
  const confirmed: BuyerConfirmation[] = []
  const unconfirmed: BuyerConfirmation[] = []
  const partial: BuyerConfirmation[] = []

  for (const t of transfers) {
    const conf = confirmations.find((c) => c.transferNo === t.transferNo)
    if (!conf) {
      const fakeConf: BuyerConfirmation = {
        id: `bcf-missing-${t.id}`,
        transferNo: t.transferNo,
        confirmDate: null,
        confirmedAmount: 0,
        status: "unconfirmed",
      }
      unconfirmed.push(fakeConf)
      anomalies.push({
        id: makeAnomalyId(),
        step: "confirm_status",
        stepLabel: "确认状态",
        category: "买方未确认",
        severity: "error",
        sourceId: t.id,
        sourceType: "transfer",
        description: `转让申请 ${t.transferNo} 无买方确认记录`,
        impact: "买方未确认将导致债权转让对抗效力存疑，影响融资安全性",
        timestamp: new Date().toISOString(),
        detail: { transferNo: t.transferNo, totalAmount: t.totalAmount },
      })
      continue
    }

    if (conf.status === "confirmed") {
      confirmed.push(conf)
    } else if (conf.status === "unconfirmed") {
      unconfirmed.push(conf)
      anomalies.push({
        id: makeAnomalyId(),
        step: "confirm_status",
        stepLabel: "确认状态",
        category: "买方未确认",
        severity: "error",
        sourceId: conf.id,
        sourceType: "confirmation",
        description: `转让申请 ${conf.transferNo} 买方未确认`,
        impact: "买方未确认金额将无法计入有效确认债权",
        timestamp: new Date().toISOString(),
        detail: { transferNo: conf.transferNo },
      })
    } else if (conf.status === "partial") {
      partial.push(conf)
      const transferTotal = transfers.find((tr) => tr.transferNo === conf.transferNo)?.totalAmount || 0
      const diff = transferTotal - conf.confirmedAmount
      anomalies.push({
        id: makeAnomalyId(),
        step: "confirm_status",
        stepLabel: "确认状态",
        category: "部分确认",
        severity: "warning",
        sourceId: conf.id,
        sourceType: "confirmation",
        description: `转让申请 ${conf.transferNo} 买方仅确认 ${formatAmount(conf.confirmedAmount)}，与转让总额 ${formatAmount(transferTotal)} 存在差异`,
        impact: `未确认金额 ${formatAmount(diff)} 存在回收风险`,
        timestamp: new Date().toISOString(),
        detail: { transferNo: conf.transferNo, confirmedAmount: conf.confirmedAmount, transferTotal, diff },
      })
    }
  }

  return {
    result: {
      confirmed: confirmed.length,
      unconfirmed: unconfirmed.length,
      partial: partial.length,
      details: { confirmed, unconfirmed, partial },
    },
    anomalies,
  }
}

export function runRepaymentMatch(
  invoices: Invoice[],
  repayments: RepaymentFlow[]
): { result: RepaymentMatchResult; anomalies: AnomalyRecord[] } {
  const anomalies: AnomalyRecord[] = []
  const matched: RepaymentFlow[] = []
  const unmatched: RepaymentFlow[] = []
  const mismatched: RepaymentFlow[] = []

  const invoicesWithRepayment = new Set<string>()

  for (const rpy of repayments) {
    const inv = invoices.find((i) => i.invoiceNo === rpy.invoiceNo)

    if (rpy.matched && !rpy.mismatchType) {
      matched.push(rpy)
      if (inv) invoicesWithRepayment.add(inv.id)
    } else if (rpy.mismatchType === "amount") {
      mismatched.push(rpy)
      if (inv) invoicesWithRepayment.add(inv.id)
      const diff = inv ? rpy.amount - inv.amount : 0
      anomalies.push({
        id: makeAnomalyId(),
        step: "repayment_match",
        stepLabel: "回款匹配",
        category: "回款金额错配",
        severity: "warning",
        sourceId: rpy.id,
        sourceType: "repayment",
        description: `回款 ${rpy.flowNo} 金额 ${formatAmount(rpy.amount)} 与发票 ${rpy.invoiceNo} 金额 ${formatAmount(inv?.amount || 0)} 不一致`,
        impact: `${diff > 0 ? "多回款" : "少回款"} ${formatAmount(Math.abs(diff))}，需要核实是否为分批回款或打款错误`,
        timestamp: new Date().toISOString(),
        detail: { flowNo: rpy.flowNo, invoiceNo: rpy.invoiceNo, repaymentAmount: rpy.amount, invoiceAmount: inv?.amount, diff },
      })
    } else if (rpy.mismatchType === "wrong_invoice") {
      mismatched.push(rpy)
      if (inv) invoicesWithRepayment.add(inv.id)
      anomalies.push({
        id: makeAnomalyId(),
        step: "repayment_match",
        stepLabel: "回款匹配",
        category: "回款指向错误",
        severity: "error",
        sourceId: rpy.id,
        sourceType: "repayment",
        description: `回款 ${rpy.flowNo} 声称对应发票 ${rpy.invoiceNo}，但该发票已存在于另一笔转让中，回款指向可能有误`,
        impact: `错配金额 ${formatAmount(rpy.amount)} 可能导致资金归属错误`,
        timestamp: new Date().toISOString(),
        detail: { flowNo: rpy.flowNo, invoiceNo: rpy.invoiceNo, amount: rpy.amount },
      })
    } else if (rpy.mismatchType === "over_payment") {
      mismatched.push(rpy)
      if (inv) invoicesWithRepayment.add(inv.id)
      const diff = inv ? rpy.amount - inv.amount : 0
      anomalies.push({
        id: makeAnomalyId(),
        step: "repayment_match",
        stepLabel: "回款匹配",
        category: "超额回款",
        severity: "warning",
        sourceId: rpy.id,
        sourceType: "repayment",
        description: `回款 ${rpy.flowNo} 金额 ${formatAmount(rpy.amount)} 超出发票 ${rpy.invoiceNo} 金额 ${formatAmount(inv?.amount || 0)}`,
        impact: `超额 ${formatAmount(Math.abs(diff))}，需核实是否包含其他发票回款或打款错误`,
        timestamp: new Date().toISOString(),
        detail: { flowNo: rpy.flowNo, invoiceNo: rpy.invoiceNo, repaymentAmount: rpy.amount, invoiceAmount: inv?.amount, diff },
      })
    } else {
      unmatched.push(rpy)
    }
  }

  for (const inv of invoices) {
    if (!invoicesWithRepayment.has(inv.id) && !repayments.some((r) => r.invoiceNo === inv.invoiceNo)) {
      anomalies.push({
        id: makeAnomalyId(),
        step: "repayment_match",
        stepLabel: "回款匹配",
        category: "无回款记录",
        severity: "info",
        sourceId: inv.id,
        sourceType: "invoice",
        description: `发票 ${inv.invoiceNo} 无对应回款记录`,
        impact: `未回款金额 ${formatAmount(inv.amount)}，需关注到期日 ${inv.dueDate}`,
        timestamp: new Date().toISOString(),
        detail: { invoiceNo: inv.invoiceNo, amount: inv.amount, dueDate: inv.dueDate },
      })
    }
  }

  return {
    result: {
      matched: matched.length,
      unmatched: unmatched.length,
      mismatched: mismatched.length,
      details: { matched, unmatched, mismatched },
    },
    anomalies,
  }
}

export function runFullAnalysis(
  invoices: Invoice[],
  transfers: TransferApplication[],
  confirmations: BuyerConfirmation[],
  repayments: RepaymentFlow[]
): AnalysisResult {
  anomalyCounter = 0

  const { result: creditorCheck, anomalies: creditorAnomalies } = runCreditorCheck(invoices, transfers)
  const { result: confirmStatus, anomalies: confirmAnomalies } = runConfirmStatusCheck(transfers, confirmations, invoices)
  const { result: repaymentMatch, anomalies: repaymentAnomalies } = runRepaymentMatch(invoices, repayments)

  const allAnomalies = [...creditorAnomalies, ...confirmAnomalies, ...repaymentAnomalies]

  const anomalyByType: Record<string, number> = {}
  for (const a of allAnomalies) {
    anomalyByType[a.category] = (anomalyByType[a.category] || 0) + 1
  }

  const totalAmount = transfers.reduce((s, t) => s + t.totalAmount, 0)
  const confirmedAmount = confirmations
    .filter((c) => c.status === "confirmed" || c.status === "partial")
    .reduce((s, c) => s + c.confirmedAmount, 0)
  const matchedAmount = repayments.filter((r) => r.matched && !r.mismatchType).reduce((s, r) => s + r.amount, 0)

  return {
    summary: {
      totalAmount,
      confirmedAmount,
      matchedAmount,
      anomalyCount: allAnomalies.length,
    },
    creditorCheck,
    confirmStatus,
    repaymentMatch,
    anomalyByType,
    anomalies: allAnomalies,
  }
}
