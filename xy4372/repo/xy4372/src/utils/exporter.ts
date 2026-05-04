import type {
  Session,
  Horse,
  VetRecord,
  ShoeingRecord,
  TackItem,
  RaceEntry,
  Risk,
  ReviewRecord,
  AppSettings,
} from '@/types'
import { riskTypeLabels, severityLabels } from './riskDetector'

interface ExportContext {
  session: Session
  horses: Horse[]
  vetRecords: VetRecord[]
  shoeingRecords: ShoeingRecord[]
  tackItems: TackItem[]
  raceEntries: RaceEntry[]
  risks: Risk[]
  reviewRecords: ReviewRecord[]
  settings: AppSettings
  exportTime: string
}

function formatDate(isoString: string): string {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatDateTime(isoString: string): string {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(isoString: string): string {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function generateMarkdownReleaseNote(context: ExportContext): string {
  const { session, horses, raceEntries, risks, reviewRecords, exportTime } = context

  const criticalRisks = risks.filter(r => r.severity === 'critical')
  const highRisks = risks.filter(r => r.severity === 'high')
  const mediumRisks = risks.filter(r => r.severity === 'medium')
  const lowRisks = risks.filter(r => r.severity === 'low')

  const confirmedRisks = reviewRecords.filter(r => r.coachJudgment === 'confirmed')
  const overruledRisks = reviewRecords.filter(r => r.coachJudgment === 'overruled')
  const pendingRisks = reviewRecords.filter(r => r.coachJudgment === 'pending')

  const unreviewedRisks = risks.filter(r => 
    !reviewRecords.some(rr => rr.riskId === r.id)
  )

  const totalIssues = risks.length
  const criticalUnresolved = criticalRisks.filter(r => {
    const review = reviewRecords.find(rr => rr.riskId === r.id)
    return !review || review.coachJudgment !== 'overruled'
  }).length

  const canRelease = criticalUnresolved === 0

  let md = `# 马术俱乐部赛前放行单\n\n`
  md += `---\n\n`

  md += `## 基本信息\n\n`
  md += `| 项目 | 内容 |\n`
  md += `|------|------|\n`
  md += `| 赛事名称 | ${session.eventName || session.name || '-'} |\n`
  md += `| 比赛地点 | ${session.location || '-'} |\n`
  md += `| 比赛日期 | ${formatDate(session.date)} |\n`
  md += `| 放行单生成时间 | ${formatDateTime(exportTime)} |\n`
  md += `| 参赛马匹数量 | ${horses.length} 匹 |\n`
  md += `| 参赛场次 | ${new Set(raceEntries.map(r => r.raceNumber)).size} 场 |\n`
  md += `\n`

  md += `## 风险检测摘要\n\n`
  md += `| 风险等级 | 数量 |\n`
  md += `|----------|------|\n`
  md += `| 🔴 严重 | ${criticalRisks.length} |\n`
  md += `| 🟠 高 | ${highRisks.length} |\n`
  md += `| 🟡 中 | ${mediumRisks.length} |\n`
  md += `| 🔵 低 | ${lowRisks.length} |\n`
  md += `| **总计** | **${totalIssues}** |\n`
  md += `\n`

  md += `## 复核状态\n\n`
  md += `| 复核结果 | 数量 |\n`
  md += `|----------|------|\n`
  md += `| ✅ 确认风险 | ${confirmedRisks.length} |\n`
  md += `| ⚖️ 推翻判定 | ${overruledRisks.length} |\n`
  md += `| ⏳ 待复核 | ${pendingRisks.length + unreviewedRisks.length} |\n`
  md += `\n`

  md += `## 放行状态\n\n`
  if (canRelease) {
    md += `### ✅ 可以放行\n\n`
    md += `所有严重风险已解决或被推翻。\n\n`
  } else {
    md += `### ❌ 不可放行\n\n`
    md += `仍有 ${criticalUnresolved} 项严重风险未解决。\n\n`
  }

  if (risks.length > 0) {
    md += `---\n\n`
    md += `## 风险详情\n\n`

    const groupedRisks: Record<string, Risk[]> = {}
    for (const risk of risks) {
      if (!groupedRisks[risk.type]) {
        groupedRisks[risk.type] = []
      }
      groupedRisks[risk.type].push(risk)
    }

    for (const [riskType, typeRisks] of Object.entries(groupedRisks)) {
      const typeLabel = riskTypeLabels[riskType] || riskType
      md += `### ${typeLabel}\n\n`

      for (const risk of typeRisks) {
        const review = reviewRecords.find(r => r.riskId === risk.id)
        const severityIcon = risk.severity === 'critical' ? '🔴' : 
                             risk.severity === 'high' ? '🟠' : 
                             risk.severity === 'medium' ? '🟡' : '🔵'

        md += `#### ${severityIcon} [${severityLabels[risk.severity]}] ${risk.horseName || risk.horseNumber}\n\n`
        md += `${risk.description}\n\n`

        if (risk.raceName || risk.raceNumber) {
          md += `**场次**: ${risk.raceName || risk.raceNumber}\n\n`
        }

        if (review) {
          md += `**复核状态**:\n\n`
          md += `- 教练判定: ${review.coachJudgment === 'confirmed' ? '✅ 确认风险' : 
                              review.coachJudgment === 'overruled' ? '⚖️ 推翻判定' : '⏳ 待复核'}\n`
          if (review.coachNotes) {
            md += `- 教练备注: ${review.coachNotes}\n`
          }
          if (review.actionTaken) {
            md += `- 处理措施: ${review.actionTaken}\n`
          }
          md += `\n`
        } else {
          md += `**复核状态**: 未复核\n\n`
        }
      }
    }
  }

  if (raceEntries.length > 0) {
    md += `---\n\n`
    md += `## 赛程安排\n\n`

    const groupedByRace: Record<string, RaceEntry[]> = {}
    for (const entry of raceEntries) {
      const key = entry.raceNumber || entry.raceName || '未知场次'
      if (!groupedByRace[key]) {
        groupedByRace[key] = []
      }
      groupedByRace[key].push(entry)
    }

    for (const [raceKey, entries] of Object.entries(groupedByRace)) {
      const firstEntry = entries[0]
      md += `### ${raceKey}\n\n`
      if (firstEntry.startTime) {
        md += `**时间**: ${formatDate(firstEntry.startTime)} ${formatTime(firstEntry.startTime)}\n\n`
      }
      if (firstEntry.location) {
        md += `**场地**: ${firstEntry.location}\n\n`
      }
      if (firstEntry.weatherCondition || firstEntry.temperature !== undefined) {
        const weatherParts: string[] = []
        if (firstEntry.weatherCondition) weatherParts.push(firstEntry.weatherCondition)
        if (firstEntry.temperature !== undefined) weatherParts.push(`${firstEntry.temperature}°C`)
        if (firstEntry.humidity !== undefined) weatherParts.push(`湿度 ${firstEntry.humidity}%`)
        if (weatherParts.length > 0) {
          md += `**天气**: ${weatherParts.join('，')}\n\n`
        }
      }

      md += `| 马号 | 马匹名称 | 骑手 | 项目 | 级别 |\n`
      md += `|------|----------|------|------|------|\n`
      for (const entry of entries) {
        md += `| ${entry.horseNumber} | ${entry.horseName || '-'} | ${entry.rider || '-'} | ${entry.category || '-'} | ${entry.class || '-'} |\n`
      }
      md += `\n`
    }
  }

  md += `---\n\n`
  md += `## 签字确认\n\n`
  md += `| 职位 | 签字 | 日期 |\n`
  md += `|------|------|------|\n`
  md += `| 主教练 | _______________ | _______________ |\n`
  md += `| 兽医 | _______________ | _______________ |\n`
  md += `| 赛事总监 | _______________ | _______________ |\n`
  md += `\n`

  md += `---\n\n`
  md += `<small>生成时间: ${formatDateTime(exportTime)} | 赛事ID: ${session.id}</small>\n`

  return md
}

function generateRiskCsv(context: ExportContext): string {
  const { risks, reviewRecords } = context

  const headers = [
    '风险ID',
    '风险类型',
    '严重程度',
    '马匹编号',
    '马匹名称',
    '场次',
    '风险标题',
    '风险描述',
    '检测时间',
    '复核状态',
    '教练判定',
    '教练备注',
    '处理措施',
    '复核时间',
    '复核人',
  ]

  const rows: string[][] = []

  for (const risk of risks) {
    const review = reviewRecords.find(r => r.riskId === risk.id)
    const row = [
      risk.id,
      riskTypeLabels[risk.type] || risk.type,
      severityLabels[risk.severity],
      risk.horseNumber,
      risk.horseName || '',
      risk.raceName || risk.raceNumber || '',
      risk.title,
      risk.description,
      formatDateTime(risk.detectedAt),
      review ? '已复核' : '未复核',
      review ? (review.coachJudgment === 'confirmed' ? '确认风险' : 
                 review.coachJudgment === 'overruled' ? '推翻判定' : '待复核') : '',
      review?.coachNotes || '',
      review?.actionTaken || '',
      review ? formatDateTime(review.reviewedAt) : '',
      review?.reviewedBy || '',
    ]
    rows.push(row)
  }

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`
      }
      return cell
    }).join(','))
  ].join('\n')

  return '\uFEFF' + csvContent
}

function generateAuditJson(context: ExportContext): string {
  const { session, horses, vetRecords, shoeingRecords, tackItems, raceEntries, risks, reviewRecords, settings, exportTime } = context

  const auditData = {
    auditId: crypto.randomUUID(),
    exportTime,
    session: {
      id: session.id,
      name: session.name,
      eventName: session.eventName,
      location: session.location,
      date: session.date,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
    statistics: {
      totalHorses: horses.length,
      totalVetRecords: vetRecords.length,
      totalShoeingRecords: shoeingRecords.length,
      totalTackItems: tackItems.length,
      totalRaceEntries: raceEntries.length,
      totalRisks: risks.length,
      risksBySeverity: {
        critical: risks.filter(r => r.severity === 'critical').length,
        high: risks.filter(r => r.severity === 'high').length,
        medium: risks.filter(r => r.severity === 'medium').length,
        low: risks.filter(r => r.severity === 'low').length,
      },
      reviewStatus: {
        confirmed: reviewRecords.filter(r => r.coachJudgment === 'confirmed').length,
        overruled: reviewRecords.filter(r => r.coachJudgment === 'overruled').length,
        pending: reviewRecords.filter(r => r.coachJudgment === 'pending').length,
        unreviewed: risks.length - reviewRecords.length,
      },
    },
    settings,
    data: {
      horses: horses.map(h => ({
        horseNumber: h.horseNumber,
        horseName: h.horseName,
        breed: h.breed,
        gender: h.gender,
        owner: h.owner,
        rider: h.rider,
      })),
      vetRecords: vetRecords.map(v => ({
        horseNumber: v.horseNumber,
        horseName: v.horseName,
        treatmentDate: v.treatmentDate,
        diagnosis: v.diagnosis,
        treatment: v.treatment,
        vetName: v.vetName,
        restPeriodDays: v.restPeriodDays,
        recoveryDate: v.recoveryDate,
        isCleared: v.isCleared,
      })),
      shoeingRecords: shoeingRecords.map(s => ({
        horseNumber: s.horseNumber,
        horseName: s.horseName,
        shoeingDate: s.shoeingDate,
        farrierName: s.farrierName,
        nextDueDate: s.nextDueDate,
      })),
      tackItems: tackItems.map(t => ({
        tackNumber: t.tackNumber,
        tackType: t.tackType,
        brand: t.brand,
        model: t.model,
        size: t.size,
        condition: t.condition,
        assignedHorseNumber: t.assignedHorseNumber,
        assignedHorseName: t.assignedHorseName,
      })),
      raceEntries: raceEntries.map(r => ({
        raceNumber: r.raceNumber,
        raceName: r.raceName,
        startTime: r.startTime,
        location: r.location,
        temperature: r.temperature,
        humidity: r.humidity,
        horseNumber: r.horseNumber,
        horseName: r.horseName,
        rider: r.rider,
        category: r.category,
        class: r.class,
      })),
    },
    risks: risks.map(r => ({
      id: r.id,
      type: r.type,
      typeLabel: riskTypeLabels[r.type] || r.type,
      severity: r.severity,
      severityLabel: severityLabels[r.severity],
      horseNumber: r.horseNumber,
      horseName: r.horseName,
      raceNumber: r.raceNumber,
      raceName: r.raceName,
      title: r.title,
      description: r.description,
      detectedAt: r.detectedAt,
      data: r.data,
      review: reviewRecords.find(rr => rr.riskId === r.id) ? {
        coachJudgment: reviewRecords.find(rr => rr.riskId === r.id)!.coachJudgment,
        coachNotes: reviewRecords.find(rr => rr.riskId === r.id)!.coachNotes,
        actionTaken: reviewRecords.find(rr => rr.riskId === r.id)!.actionTaken,
        reviewedAt: reviewRecords.find(rr => rr.riskId === r.id)!.reviewedAt,
        reviewedBy: reviewRecords.find(rr => rr.riskId === r.id)!.reviewedBy,
      } : null,
    })),
    releaseStatus: {
      canRelease: risks.filter(r => {
        if (r.severity !== 'critical') return true
        const review = reviewRecords.find(rr => rr.riskId === r.id)
        return review && review.coachJudgment === 'overruled'
      }).length === risks.length,
      unresolvedCriticalCount: risks.filter(r => {
        if (r.severity !== 'critical') return false
        const review = reviewRecords.find(rr => rr.riskId === r.id)
        return !review || review.coachJudgment !== 'overruled'
      }).length,
    },
  }

  return JSON.stringify(auditData, null, 2)
}

export function exportAll(
  context: Omit<ExportContext, 'exportTime'>
): {
  markdown: string
  csv: string
  json: string
  filenames: {
    markdown: string
    csv: string
    json: string
  }
} {
  const exportTime = new Date().toISOString()
  const fullContext: ExportContext = {
    ...context,
    exportTime,
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const sessionName = context.session.name || context.session.eventName || 'precheck'
  const safeName = sessionName.replace(/[\\/:*?"<>|]/g, '_')

  return {
    markdown: generateMarkdownReleaseNote(fullContext),
    csv: generateRiskCsv(fullContext),
    json: generateAuditJson(fullContext),
    filenames: {
      markdown: `${safeName}_放行单_${timestamp}.md`,
      csv: `${safeName}_风险清单_${timestamp}.csv`,
      json: `${safeName}_审计包_${timestamp}.json`,
    },
  }
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadMarkdown(content: string, filename: string): void {
  downloadFile(content, filename, 'text/markdown;charset=utf-8')
}

export function downloadCsv(content: string, filename: string): void {
  downloadFile(content, filename, 'text/csv;charset=utf-8')
}

export function downloadJson(content: string, filename: string): void {
  downloadFile(content, filename, 'application/json;charset=utf-8')
}
