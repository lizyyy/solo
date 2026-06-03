import type { CounterExample, RunRecord, SelfCheckResult, SelfCheckDetail } from "../types"

function checkDuplicateImport(counterExamples: CounterExample[]): SelfCheckResult {
  const details: SelfCheckDetail[] = []
  let found = false

  for (let i = 0; i < counterExamples.length; i++) {
    for (let j = i + 1; j < counterExamples.length; j++) {
      const a = counterExamples[i]
      const b = counterExamples[j]
      if (
        a.source === b.source &&
        Math.abs(a.originalValue - b.originalValue) < 0.001 &&
        Math.abs(a.threshold - b.threshold) < 0.001
      ) {
        found = true
        details.push({
          item: `${a.id} 与 ${b.id}`,
          status: "fail",
          message: `来源=${a.source}, 原始值≈${a.originalValue.toFixed(3)}, 阈值≈${a.threshold.toFixed(3)}`,
        })
      }
    }
  }

  if (!found) {
    details.push({
      item: "重复导入检查",
      status: "pass",
      message: "未发现重复导入的反例",
    })
  }

  return {
    type: "duplicate_import",
    passed: !found,
    details,
  }
}

function checkBoundaryThreshold(counterExamples: CounterExample[]): SelfCheckResult {
  const details: SelfCheckDetail[] = []
  let allCorrect = true

  for (const ce of counterExamples) {
    if (ce.originalValue === ce.threshold) {
      if (ce.status !== "boundary" && ce.status !== "pending_review") {
        allCorrect = false
        details.push({
          item: ce.id,
          status: "fail",
          message: `originalValue===threshold 但状态为 "${ce.status}"，应为 "boundary" 或 "pending_review"`,
        })
      }
    }
  }

  if (allCorrect) {
    details.push({
      item: "边界阈值检查",
      status: "pass",
      message: "所有 originalValue===threshold 的条目状态正确",
    })
  }

  return {
    type: "boundary_threshold",
    passed: allCorrect,
    details,
  }
}

function checkSupplementaryRecalc(counterExamples: CounterExample[], runRecords: RunRecord[]): SelfCheckResult {
  const details: SelfCheckDetail[] = []
  const supplementaryRecords = runRecords.filter(r => r.mode === "supplementary")
  let allValid = true

  for (const record of supplementaryRecords) {
    const relatedCEs = counterExamples.filter(ce => record.counterExampleIds.includes(ce.id))
    for (const ce of relatedCEs) {
      if (ce.source !== "supplementary") {
        allValid = false
        details.push({
          item: ce.id,
          status: "fail",
          message: `补充运行记录 ${record.id} 中包含非补充来源的反例`,
        })
      }
    }
  }

  if (allValid) {
    details.push({
      item: "补充重算检查",
      status: "pass",
      message: "补充运行中的反例来源一致",
    })
  }

  return {
    type: "supplementary_recalc",
    passed: allValid,
    details,
  }
}

function checkExportConsistency(counterExamples: CounterExample[], runRecords: RunRecord[]): SelfCheckResult {
  const details: SelfCheckDetail[] = []
  let allConsistent = true

  for (const record of runRecords) {
    const relatedCEs = counterExamples.filter(ce => record.counterExampleIds.includes(ce.id))
    const summary = record.summary

    const expectedNormal = relatedCEs.filter(ce => ce.status === "normal").length
    const expectedBoundary = relatedCEs.filter(ce => ce.status === "boundary").length
    const expectedConflict = relatedCEs.filter(ce => ce.status === "conflict").length
    const expectedPending = relatedCEs.filter(ce => ce.status === "pending_review").length

    const mismatches: string[] = []
    if (expectedNormal !== summary.normalCount) mismatches.push(`normal: 记录=${summary.normalCount}, 实际=${expectedNormal}`)
    if (expectedBoundary !== summary.boundaryCount) mismatches.push(`boundary: 记录=${summary.boundaryCount}, 实际=${expectedBoundary}`)
    if (expectedConflict !== summary.conflictCount) mismatches.push(`conflict: 记录=${summary.conflictCount}, 实际=${expectedConflict}`)
    if (expectedPending !== summary.pendingReviewCount) mismatches.push(`pending: 记录=${summary.pendingReviewCount}, 实际=${expectedPending}`)

    if (mismatches.length > 0) {
      allConsistent = false
      details.push({
        item: `运行记录 ${record.id}`,
        status: "fail",
        message: `摘要不一致: ${mismatches.join("; ")}`,
      })
    }
  }

  if (allConsistent) {
    details.push({
      item: "导出一致性检查",
      status: "pass",
      message: "所有运行记录摘要与实际反例计数一致",
    })
  }

  return {
    type: "export_consistency",
    passed: allConsistent,
    details,
  }
}

export function runSelfChecks(
  counterExamples: CounterExample[],
  runRecords: RunRecord[]
): SelfCheckResult[] {
  return [
    checkDuplicateImport(counterExamples),
    checkBoundaryThreshold(counterExamples),
    checkSupplementaryRecalc(counterExamples, runRecords),
    checkExportConsistency(counterExamples, runRecords),
  ]
}
