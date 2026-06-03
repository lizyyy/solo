import type { CounterExample, QuestionnaireRow, RunRecord, ConflictEvidence, SelfCheckResult } from "../types"

export function generateReport(
  counterExamples: CounterExample[],
  _questionnaireRows: QuestionnaireRow[],
  runRecords: RunRecord[],
  conflictEvidences: ConflictEvidence[],
  selfCheckResults: SelfCheckResult[]
): string {
  const lines: string[] = []

  lines.push("# 梯度下降学习率演示 - 分析报告")
  lines.push("")

  lines.push("## 报告概览")
  lines.push("")
  lines.push(`- 反例总数: ${counterExamples.length}`)
  lines.push(`- 正常: ${counterExamples.filter(c => c.status === "normal").length}`)
  lines.push(`- 边界: ${counterExamples.filter(c => c.status === "boundary").length}`)
  lines.push(`- 冲突: ${counterExamples.filter(c => c.status === "conflict").length}`)
  lines.push(`- 待审核: ${counterExamples.filter(c => c.status === "pending_review").length}`)
  lines.push(`- 运行记录数: ${runRecords.length}`)
  lines.push(`- 冲突证据数: ${conflictEvidences.length}`)
  lines.push("")

  lines.push("## 反例列表")
  lines.push("")
  lines.push("| ID | 来源 | 原始值 | 阈值 | 偏差 | 状态 |")
  lines.push("|---|---|---|---|---|---|")
  for (const ce of counterExamples) {
    lines.push(`| ${ce.id} | ${ce.source} | ${ce.originalValue} | ${ce.threshold} | ${ce.deviation} | ${ce.status} |`)
  }
  lines.push("")

  lines.push("## 冲突处理记录")
  lines.push("")
  if (conflictEvidences.length === 0) {
    lines.push("无冲突记录")
  } else {
    lines.push("| 反例ID | 反例值 | 问卷值 | 冲突字段 |")
    lines.push("|---|---|---|---|")
    for (const ev of conflictEvidences) {
      lines.push(`| ${ev.counterExampleId} | ${ev.counterExampleValue} | ${ev.questionnaireValue} | ${ev.conflictingFields.join(", ")} |`)
    }
  }
  lines.push("")

  const resolved = counterExamples.filter(ce => ce.conflictResolution !== null)
  if (resolved.length > 0) {
    lines.push("### 冲突解决结果")
    lines.push("")
    lines.push("| 反例ID | 解决方式 |")
    lines.push("|---|---|")
    for (const ce of resolved) {
      lines.push(`| ${ce.id} | ${ce.conflictResolution} |`)
    }
    lines.push("")
  }

  lines.push("## 自检结果")
  lines.push("")
  for (const result of selfCheckResults) {
    const icon = result.passed ? "✅" : "❌"
    lines.push(`### ${icon} ${result.type}`)
    lines.push("")
    for (const detail of result.details) {
      const statusIcon = detail.status === "pass" ? "✓" : "✗"
      lines.push(`- ${statusIcon} ${detail.item}: ${detail.message}`)
    }
    lines.push("")
  }

  lines.push("## 导出时间")
  lines.push("")
  lines.push(new Date().toLocaleString("zh-CN"))

  return lines.join("\n")
}
