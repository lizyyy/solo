function formatDate() {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

function formatDateTime() {
  const now = new Date()
  return now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function getRiskLevelLabel(level) {
  const labels = { high: '高风险', medium: '中风险', low: '低风险' }
  return labels[level] || level
}

function getStatusLabel(status) {
  const labels = { pending: '待处理', resolved: '已解决', dismissed: '已驳回' }
  return labels[status] || status
}

function getCategoryLabel(category) {
  const labels = {
    overload: '超载',
    movement: '走位冲突',
    permit: '许可问题',
    timing: '时间冲突',
    other: '其他'
  }
  return labels[category] || category
}

export const exportUtils = {
  generateMarkdown(data, risks) {
    const stats = {
      high: risks.filter(r => r.level === 'high' && r.status === 'pending').length,
      medium: risks.filter(r => r.level === 'medium' && r.status === 'pending').length,
      low: risks.filter(r => r.level === 'low' && r.status === 'pending').length,
      resolved: risks.filter(r => r.status === 'resolved').length,
      dismissed: risks.filter(r => r.status === 'dismissed').length
    }

    let markdown = `# 🎭 演前安全复核报告\n\n`
    markdown += `> 生成时间: ${formatDateTime()}\n\n`
    
    markdown += `## 📊 风险概览\n\n`
    markdown += `| 风险等级 | 数量 |\n`
    markdown += `|---------|------|\n`
    markdown += `| 🔴 高风险 | ${stats.high} |\n`
    markdown += `| 🟡 中风险 | ${stats.medium} |\n`
    markdown += `| 🔵 低风险 | ${stats.low} |\n`
    markdown += `| ✅ 已解决 | ${stats.resolved} |\n`
    markdown += `| ⚪ 已驳回 | ${stats.dismissed} |\n\n`

    if (stats.high > 0) {
      markdown += `## ⚠️ 高风险警告\n\n`
      const highRisks = risks.filter(r => r.level === 'high' && r.status === 'pending')
      highRisks.forEach((risk, index) => {
        markdown += `### ${index + 1}. ${risk.title}\n\n`
        markdown += `- **时间**: ${risk.time}\n`
        markdown += `- **类型**: ${getCategoryLabel(risk.category)}\n`
        markdown += `- **状态**: ${getStatusLabel(risk.status)}\n`
        markdown += `- **描述**: ${risk.description}\n`
        if (risk.notes) {
          markdown += `- **备注**: ${risk.notes}\n`
        }
        markdown += '\n'
      })
    }

    if (stats.medium > 0) {
      markdown += `## 📋 中风险清单\n\n`
      const mediumRisks = risks.filter(r => r.level === 'medium' && r.status === 'pending')
      mediumRisks.forEach((risk, index) => {
        markdown += `### ${index + 1}. ${risk.title}\n\n`
        markdown += `- **时间**: ${risk.time}\n`
        markdown += `- **类型**: ${getCategoryLabel(risk.category)}\n`
        markdown += `- **状态**: ${getStatusLabel(risk.status)}\n`
        markdown += `- **描述**: ${risk.description}\n`
        if (risk.notes) {
          markdown += `- **备注**: ${risk.notes}\n`
        }
        markdown += '\n'
      })
    }

    markdown += `## 📝 数据统计\n\n`
    markdown += `### Cue 表\n`
    if (data.cueTable) {
      markdown += `- 总 Cue 数: ${data.cueTable.length}\n`
      markdown += `- 时间范围: ${data.cueTable[0]?.time} ~ ${data.cueTable[data.cueTable.length - 1]?.time}\n\n`
    } else {
      markdown += `- 未导入\n\n`
    }

    markdown += `### 设备清单\n`
    if (data.equipment) {
      const booms = data.equipment.filter(e => e.type === '吊杆').length
      const lifts = data.equipment.filter(e => e.type === '升降台').length
      markdown += `- 总设备数: ${data.equipment.length}\n`
      markdown += `- 吊杆: ${booms} 台\n`
      markdown += `- 升降台: ${lifts} 台\n\n`
    } else {
      markdown += `- 未导入\n\n`
    }

    markdown += `### 演员走位\n`
    if (data.movements) {
      markdown += `- 总走位数: ${data.movements.length}\n`
      const actors = new Set(data.movements.map(m => m.actor))
      markdown += `- 涉及演员: ${actors.size} 人\n\n`
    } else {
      markdown += `- 未导入\n\n`
    }

    markdown += `### 烟火许可\n`
    if (data.pyroPermits) {
      markdown += `- 总许可数: ${data.pyroPermits.length}\n`
      const validPermits = data.pyroPermits.filter(p => {
        const expiryDate = new Date(p.expiryDate)
        return expiryDate >= new Date()
      })
      markdown += `- 有效许可: ${validPermits.length} 个\n\n`
    } else {
      markdown += `- 未导入\n\n`
    }

    markdown += `---\n\n`
    markdown += `*此报告由舞台安全复核工具自动生成*\n`

    return markdown
  },

  generateCSV(risks) {
    const headers = ['ID', '时间', '等级', '类型', '标题', '描述', '状态', '备注']
    
    let csv = headers.join(',') + '\n'
    
    risks.forEach(risk => {
      const row = [
        risk.id,
        risk.time,
        getRiskLevelLabel(risk.level),
        getCategoryLabel(risk.category),
        `"${risk.title.replace(/"/g, '""')}"`,
        `"${risk.description.replace(/"/g, '""')}"`,
        getStatusLabel(risk.status),
        risk.notes ? `"${risk.notes.replace(/"/g, '""')}"` : ''
      ]
      csv += row.join(',') + '\n'
    })
    
    return csv
  },

  generateJSONPackage(data, risks) {
    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      data: {
        cueTable: data.cueTable || [],
        equipment: data.equipment || [],
        movements: data.movements || [],
        pyroPermits: data.pyroPermits || []
      },
      risks: risks.map(risk => ({
        id: risk.id,
        category: risk.category,
        level: risk.level,
        time: risk.time,
        title: risk.title,
        description: risk.description,
        status: risk.status,
        notes: risk.notes || '',
        details: risk.details || {}
      })),
      summary: {
        totalRisks: risks.length,
        byLevel: {
          high: risks.filter(r => r.level === 'high').length,
          medium: risks.filter(r => r.level === 'medium').length,
          low: risks.filter(r => r.level === 'low').length
        },
        byStatus: {
          pending: risks.filter(r => r.status === 'pending').length,
          resolved: risks.filter(r => r.status === 'resolved').length,
          dismissed: risks.filter(r => r.status === 'dismissed').length
        },
        pendingHigh: risks.filter(r => r.level === 'high' && r.status === 'pending').length
      }
    }
  }
}
