import { Material, WeightConfig, RoomConfig, ScoreBreakdown, FREQUENCY_BANDS, ValidationIssue, MaterialCombination, LOW_FREQ_BANDS, MID_FREQ_BANDS, HIGH_FREQ_BANDS } from '@/types'
import { calculateScore } from './scoring'
import { validateAllMaterials, getIssuesByType } from './validation'
import { checkBudgetOverrun } from './scoring'
import { calculateBudgetPerSqm, formatCurrency, calculateTotalArea } from './budget'

function generateReportText(
  materials: Material[],
  weightConfig: WeightConfig,
  roomConfig: RoomConfig,
  combinations: MaterialCombination[],
  scores: ScoreBreakdown[],
): string {
  const issues = validateAllMaterials(materials)
  const budgetPerSqm = calculateBudgetPerSqm(roomConfig)
  const overrunIssues = checkBudgetOverrun(materials, issues, budgetPerSqm)
  const allIssues = [...issues, ...overrunIssues]
  const grouped = getIssuesByType(allIssues)
  const totalArea = calculateTotalArea(roomConfig)

  let report = `声学降噪材料筛选报告\n`
  report += `${'='.repeat(50)}\n\n`

  report += `一、项目信息\n`
  report += `  房间尺寸: ${roomConfig.length}m × ${roomConfig.width}m × ${roomConfig.height}m\n`
  report += `  总面积: ${totalArea.toFixed(1)} m²\n`
  report += `  总预算: ${formatCurrency(roomConfig.budget)}\n`
  report += `  每平米预算: ${formatCurrency(budgetPerSqm)}/m²\n\n`

  report += `二、频段加权配置\n`
  report += `  低频(125/250Hz)权重: ${weightConfig.lowWeight}\n`
  report += `  中频(500/1kHz)权重: ${weightConfig.midWeight}\n`
  report += `  高频(2/4kHz)权重: ${weightConfig.highWeight}\n\n`

  report += `三、数据质量检查\n`
  report += `  系数越界: ${grouped.outOfRange.length} 项\n`
  report += `  频段缺样: ${grouped.missing.length} 项\n`
  report += `  预算超限: ${grouped.budgetOverrun.length} 项\n`
  if (allIssues.length > 0) {
    report += `  异常详情:\n`
    allIssues.forEach((i) => {
      report += `    ${i.severity === 'error' ? '❌' : '⚡'} ${i.detail}\n`
    })
  } else {
    report += `  ✓ 所有数据正常\n`
  }
  report += `\n`

  report += `四、材料评分排序\n`
  const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore)
  sorted.forEach((s, idx) => {
    const mat = materials.find((m) => m.id === s.materialId)
    const overrun = s.issues.some((i) => i.type === 'budget_overrun')
    report += `  ${idx + 1}. ${s.materialName} — 评分: ${s.totalScore.toFixed(4)}`
    if (overrun) report += ` [预算超限]`
    if (s.issues.filter((i) => i.type !== 'budget_overrun').length > 0) report += ` [数据异常]`
    report += `\n`
    if (mat) {
      FREQUENCY_BANDS.forEach((freq) => {
        const val = mat.coefficients[freq]
        const bandGroup = LOW_FREQ_BANDS.includes(freq) ? '低频' : MID_FREQ_BANDS.includes(freq) ? '中频' : '高频'
        report += `       ${freq}(${bandGroup}): ${val !== null ? val : '缺失'}\n`
      })
      report += `       单价: ${formatCurrency(mat.unitPrice)}/m²\n`
    }
  })

  if (combinations.length > 0) {
    report += `\n五、材料组合方案\n`
    combinations.forEach((combo, idx) => {
      report += `  方案${idx + 1}: ${combo.name}\n`
      report += `       综合评分: ${combo.weightedScore.toFixed(4)}\n`
      report += `       总费用: ${formatCurrency(combo.totalCost)}\n`
      combo.items.forEach((item) => {
        const mat = materials.find((m) => m.id === item.materialId)
        if (mat) {
          report += `       - ${mat.name}: 占比 ${(item.areaRatio * 100).toFixed(0)}%\n`
        }
      })
    })
  }

  report += `\n${'='.repeat(50)}\n`
  report += `报告生成时间: ${new Date().toLocaleString('zh-CN')}\n`

  return report
}

export function exportAsJSON(
  materials: Material[],
  weightConfig: WeightConfig,
  roomConfig: RoomConfig,
  combinations: MaterialCombination[],
  scores: ScoreBreakdown[],
) {
  const data = {
    reportTime: new Date().toISOString(),
    roomConfig,
    weightConfig,
    materials: materials.map((m) => ({
      ...m,
      score: scores.find((s) => s.materialId === m.id)?.totalScore,
    })),
    combinations,
    scores,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `声学筛选报告_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportAsPDF(
  materials: Material[],
  weightConfig: WeightConfig,
  roomConfig: RoomConfig,
  combinations: MaterialCombination[],
  scores: ScoreBreakdown[],
) {
  const text = generateReportText(materials, weightConfig, roomConfig, combinations, scores)
  import('jspdf').then(({ default: jsPDF }) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    doc.setFont('helvetica')
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(text, 180)
    let y = 20
    lines.forEach((line: string) => {
      if (y > 275) {
        doc.addPage()
        y = 20
      }
      doc.text(line, 15, y)
      y += 5
    })
    doc.save(`声学筛选报告_${new Date().toISOString().slice(0, 10)}.pdf`)
  })
}

export { generateReportText }
