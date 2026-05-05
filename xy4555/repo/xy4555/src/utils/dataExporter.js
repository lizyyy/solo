import { useDataStore } from '@/store'
import { DataTypes, RiskTypes, TunnelSection, GasSensor, InspectionTicket, ManholeRecord, RiskMarker, JudgmentNote } from '@/models'

export class DataExporter {
  constructor() {
    this.store = useDataStore()
  }

  async exportMarkdownHandover() {
    const sections = await this.store.getItems(DataTypes.TUNNEL_SECTIONS)
    const sensors = await this.store.getItems(DataTypes.GAS_SENSORS)
    const tickets = await this.store.getItems(DataTypes.INSPECTION_TICKETS)
    const manholes = await this.store.getItems(DataTypes.MANHOLE_RECORDS)
    const risks = await this.store.getItems(DataTypes.RISK_MARKERS)
    const notes = await this.store.getItems(DataTypes.JUDGMENT_NOTES)

    const now = new Date()
    const dateStr = now.toLocaleDateString('zh-CN')
    const timeStr = now.toLocaleTimeString('zh-CN')

    let md = `# 城市地下管廊巡检交班单

**交班日期**: ${dateStr}  
**交班时间**: ${timeStr}  

---

## 一、风险汇总

| 风险类型 | 数量 | 状态 |
|---------|------|------|
| 缺氧风险 | ${this.countRisksByType(risks, RiskTypes.OXYGEN_DEFICIENCY)} | ${this.getRiskStatusSummary(risks, RiskTypes.OXYGEN_DEFICIENCY, notes)} |
| 可燃气体风险 | ${this.countRisksByType(risks, RiskTypes.FLAMMABLE_GAS)} | ${this.getRiskStatusSummary(risks, RiskTypes.FLAMMABLE_GAS, notes)} |
| 积水风险 | ${this.countRisksByType(risks, RiskTypes.WATER_ACCUMULATION)} | ${this.getRiskStatusSummary(risks, RiskTypes.WATER_ACCUMULATION, notes)} |
| 未闭环工单 | ${this.countRisksByType(risks, RiskTypes.UNOPENED_TICKET)} | ${this.getRiskStatusSummary(risks, RiskTypes.UNOPENED_TICKET, notes)} |

---

## 二、详细风险情况

### 2.1 缺氧风险

${this.renderRiskDetails(risks, RiskTypes.OXYGEN_DEFICIENCY, sections, sensors, notes)}

### 2.2 可燃气体风险

${this.renderRiskDetails(risks, RiskTypes.FLAMMABLE_GAS, sections, sensors, notes)}

### 2.3 积水风险

${this.renderRiskDetails(risks, RiskTypes.WATER_ACCUMULATION, sections, sensors, notes)}

### 2.4 未闭环工单

${this.renderRiskDetails(risks, RiskTypes.UNOPENED_TICKET, sections, tickets, notes)}

---

## 三、巡检工单状态

| 工单编号 | 管廊分段 | 类型 | 状态 | 巡检员 | 计划时间 |
|---------|---------|------|------|--------|---------|
${tickets.map(t => `| ${t.ticketNo} | ${t.sectionName || '-'} | ${t.inspectionType} | ${this.getStatusText(t.status)} | ${t.inspector || '-'} | ${t.scheduledTime ? new Date(t.scheduledTime).toLocaleString('zh-CN') : '-'} |`).join('\n')}

---

## 四、井盖开启记录

| 井盖编号 | 管廊分段 | 状态 | 开启时间 | 关闭时间 | 操作人 |
|---------|---------|------|---------|---------|--------|
${manholes.map(m => `| ${m.manholeNo} | ${this.getSectionName(sections, m.sectionId)} | ${m.status === 'open' ? '开启中 ⚠️' : '已关闭'} | ${m.openTime ? new Date(m.openTime).toLocaleString('zh-CN') : '-'} | ${m.closeTime ? new Date(m.closeTime).toLocaleString('zh-CN') : '-'} | ${m.operator || '-'} |`).join('\n')}

---

## 五、人工改判备注

${notes.length > 0 ? notes.map(n => `
### 改判记录 - ${new Date(n.createdAt).toLocaleString('zh-CN')}

- **风险ID**: ${n.riskId}
- **改判结果**: ${this.getJudgmentText(n.judgment)}
- **改判人**: ${n.operator || '-'}
- **备注**: ${n.remark || '无'}
`).join('\n') : '*暂无改判记录*'}

---

## 六、注意事项

1. 请接班人员重点关注红色标记的高风险区域
2. 开启中的井盖需要重点监护
3. 未闭环工单请及时跟进处理
4. 所有改判记录已保存至系统

---

**交班人签字**: _______________  
**接班人签字**: _______________  
**交接时间**: _______________
`

    return md
  }

  async exportJsonDetails() {
    const sections = await this.store.getItems(DataTypes.TUNNEL_SECTIONS)
    const sensors = await this.store.getItems(DataTypes.GAS_SENSORS)
    const tickets = await this.store.getItems(DataTypes.INSPECTION_TICKETS)
    const manholes = await this.store.getItems(DataTypes.MANHOLE_RECORDS)
    const risks = await this.store.getItems(DataTypes.RISK_MARKERS)
    const notes = await this.store.getItems(DataTypes.JUDGMENT_NOTES)

    const exportData = {
      exportTime: new Date().toISOString(),
      summary: {
        totalSections: sections.length,
        totalSensors: sensors.length,
        totalTickets: tickets.length,
        totalManholes: manholes.length,
        totalRisks: risks.length,
        oxygenRisks: this.countRisksByType(risks, RiskTypes.OXYGEN_DEFICIENCY),
        gasRisks: this.countRisksByType(risks, RiskTypes.FLAMMABLE_GAS),
        waterRisks: this.countRisksByType(risks, RiskTypes.WATER_ACCUMULATION),
        ticketRisks: this.countRisksByType(risks, RiskTypes.UNOPENED_TICKET)
      },
      tunnel_sections: sections,
      gas_sensors: sensors,
      inspection_tickets: tickets,
      manhole_records: manholes,
      risk_markers: risks,
      judgment_notes: notes
    }

    return JSON.stringify(exportData, null, 2)
  }

  downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  countRisksByType(risks, type) {
    return risks.filter(r => r.type === type).length
  }

  getRiskStatusSummary(risks, type, notes) {
    const typeRisks = risks.filter(r => r.type === type)
    if (typeRisks.length === 0) return '无风险'

    const judged = typeRisks.filter(r => r.judgment !== null)
    const unjudged = typeRisks.filter(r => r.judgment === null)
    
    const confirmed = judged.filter(r => r.judgment === 'confirm').length
    const dismissed = judged.filter(r => r.judgment === 'dismiss').length

    let summary = []
    if (unjudged.length > 0) summary.push(`${unjudged.length}待确认`)
    if (confirmed > 0) summary.push(`${confirmed}已确认`)
    if (dismissed > 0) summary.push(`${dismissed}已排除`)

    return summary.join(' / ')
  }

  renderRiskDetails(risks, type, sections, sources, notes) {
    const typeRisks = risks.filter(r => r.type === type)
    if (typeRisks.length === 0) return '*暂无此类风险*'

    return typeRisks.map(risk => {
      const section = sections.find(s => s.id === risk.sectionId)
      const source = sources.find(s => s.id === risk.sourceId)
      const riskNotes = notes.filter(n => n.riskId === risk.id)

      return `
#### ${risk.message}

- **管廊分段**: ${section ? section.name : '-'}
- **位置**: X: ${risk.position.x?.toFixed(1)}, Y: ${risk.position.y?.toFixed(1)}, Z: ${risk.position.z?.toFixed(1)}
- **风险等级**: ${risk.level === 'high' ? '高 ⚠️' : '中'}
- **状态**: ${risk.judgment === null ? '待确认' : this.getJudgmentText(risk.judgment)}
${source ? `- **来源数据**: ${this.formatSourceInfo(source)}` : ''}
${riskNotes.length > 0 ? `- **改判记录**: ${riskNotes.map(n => `${new Date(n.createdAt).toLocaleString('zh-CN')} - ${this.getJudgmentText(n.judgment)}: ${n.remark || '无'}`).join('; ')}` : ''}
`
    }).join('\n')
  }

  formatSourceInfo(source) {
    if (source instanceof GasSensor || source.oxygenLevel !== undefined) {
      return `传感器 ${source.code || source.id} - 氧气: ${source.oxygenLevel}%, 可燃气体: ${source.flammableGasLevel}%LEL`
    }
    if (source instanceof InspectionTicket || source.ticketNo) {
      return `工单 ${source.ticketNo} - ${source.inspectionType}, 状态: ${this.getStatusText(source.status)}`
    }
    return source.id || source.name || '-'
  }

  getSectionName(sections, sectionId) {
    const section = sections.find(s => s.id === sectionId)
    return section ? section.name : '-'
  }

  getStatusText(status) {
    const statusMap = {
      'pending': '待处理',
      'in_progress': '进行中',
      'completed': '已完成',
      'closed': '已关闭'
    }
    return statusMap[status] || status
  }

  getJudgmentText(judgment) {
    const judgmentMap = {
      'confirm': '确认风险',
      'dismiss': '排除误报',
      'defer': '延后处理'
    }
    return judgmentMap[judgment] || judgment
  }
}

export const useDataExporter = () => new DataExporter()
