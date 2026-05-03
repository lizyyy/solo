export class ReportExporter {
  static generateSectionReport(contexts, finds, rules, validationResult) {
    const now = new Date()
    const dateStr = now.toLocaleDateString('zh-CN')
    const timeStr = now.toLocaleTimeString('zh-CN')

    const summary = validationResult?.summary || { total: 0, bySeverity: {}, byType: {} }
    const statistics = validationResult?.statistics || {}
    const issues = validationResult?.issues || []

    let report = `# 探方地层记录复核报告

**生成时间**: ${dateStr} ${timeStr}

---

## 一、数据概览

### 1.1 探方信息

| 属性 | 值 |
|------|-----|
| 探方编号 | ${rules?.trench?.id || 'T1'} |
| 探方名称 | ${rules?.trench?.name || '探方 1'} |
| X轴范围 | ${rules?.trench?.dimensions?.x_min ?? 0} - ${rules?.trench?.dimensions?.x_max ?? 10} m |
| Y轴范围 | ${rules?.trench?.dimensions?.y_min ?? 0} - ${rules?.trench?.dimensions?.y_max ?? 10} m |
| Z轴范围 | ${rules?.trench?.dimensions?.z_min ?? 0} - ${rules?.trench?.dimensions?.z_max ?? 5} m |

### 1.2 统计数据

| 类别 | 数量 |
|------|------|
| 地层数 | ${contexts?.length || 0} |
| 出土物数 | ${finds?.length || 0} |

---

## 二、问题检测结果

### 2.1 问题汇总

| 严重程度 | 数量 |
|----------|------|
| 严重 (Critical) | ${summary.bySeverity?.critical || 0} |
| 高 (High) | ${summary.bySeverity?.high || 0} |
| 中 (Medium) | ${summary.bySeverity?.medium || 0} |
| 低 (Low) | ${summary.bySeverity?.low || 0} |
| **总计** | **${summary.total}** |

### 2.2 按类别统计

| 类别 | 错误 | 警告 | 总计 |
|------|------|------|------|
| 高程校验 | ${statistics.elevation?.errors || 0} | ${statistics.elevation?.warnings || 0} | ${statistics.elevation?.total || 0} |
| 关系校验 | ${statistics.relationship?.errors || 0} | ${statistics.relationship?.warnings || 0} | ${statistics.relationship?.total || 0} |
| 坐标校验 | ${statistics.coordinate?.errors || 0} | ${statistics.coordinate?.warnings || 0} | ${statistics.coordinate?.total || 0} |

---

## 三、详细问题列表

`

    const criticalIssues = issues.filter(i => i.severity === 'critical')
    const highIssues = issues.filter(i => i.severity === 'high')
    const mediumIssues = issues.filter(i => i.severity === 'medium')
    const lowIssues = issues.filter(i => i.severity === 'low')

    if (criticalIssues.length > 0) {
      report += `
### 3.1 严重问题 (Critical)

`
      criticalIssues.forEach((issue, index) => {
        report += `
#### 问题 ${index + 1}: ${issue.message}

- **类别**: ${this.getCategoryName(issue.category)}
- **地层编号**: ${issue.layerId || '无'}
- **出土物编号**: ${issue.findId || '无'}
- **详情**: ${issue.detail}

`
      })
    }

    if (highIssues.length > 0) {
      report += `
### 3.2 高优先级问题 (High)

`
      highIssues.forEach((issue, index) => {
        report += `
#### 问题 ${index + 1}: ${issue.message}

- **类别**: ${this.getCategoryName(issue.category)}
- **地层编号**: ${issue.layerId || '无'}
- **出土物编号**: ${issue.findId || '无'}
- **详情**: ${issue.detail}

`
      })
    }

    if (mediumIssues.length > 0) {
      report += `
### 3.3 中优先级问题 (Medium)

`
      mediumIssues.forEach((issue, index) => {
        report += `
#### 问题 ${index + 1}: ${issue.message}

- **类别**: ${this.getCategoryName(issue.category)}
- **地层编号**: ${issue.layerId || '无'}
- **出土物编号**: ${issue.findId || '无'}
- **详情**: ${issue.detail}

`
      })
    }

    report += `
---

## 四、地层详情

### 4.1 地层列表

`

    if (contexts && contexts.length > 0) {
      report += `
| 地层编号 | 名称 | 年代 | 顶部高程 | 底部高程 | 厚度 | 出土物数 |
|----------|------|------|----------|----------|------|----------|
`
      contexts.forEach((ctx) => {
        const layerFinds = finds?.filter(f => f.layerId === ctx.id) || []
        const thickness = ctx.elevation.top !== null && ctx.elevation.bottom !== null
          ? (ctx.elevation.top - ctx.elevation.bottom).toFixed(2)
          : '-'
        report += `| ${ctx.id} | ${ctx.name} | ${ctx.age} | ${ctx.elevation.top ?? '-'} | ${ctx.elevation.bottom ?? '-'} | ${thickness} | ${layerFinds.length} |\n`
      })
    }

    report += `
### 4.2 地层关系图

`
    contexts?.forEach((ctx) => {
      const rel = ctx.relationships
      const hasRelationships = rel.overlies.length > 0 || rel.underlies.length > 0 || 
                              rel.cuts.length > 0 || rel.cutBy.length > 0 ||
                              rel.equalTo.length > 0
      
      if (hasRelationships) {
        report += `
#### 地层 ${ctx.id}

`
        if (rel.overlies.length > 0) {
          report += `- **叠压于**: ${rel.overlies.join(', ')}\n`
        }
        if (rel.underlies.length > 0) {
          report += `- **被叠压**: ${rel.underlies.join(', ')}\n`
        }
        if (rel.cuts.length > 0) {
          report += `- **打破**: ${rel.cuts.join(', ')}\n`
        }
        if (rel.cutBy.length > 0) {
          report += `- **被打破**: ${rel.cutBy.join(', ')}\n`
        }
        if (rel.equalTo.length > 0) {
          report += `- **等同于**: ${rel.equalTo.join(', ')}\n`
        }
      }
    })

    report += `
---

## 五、出土物详情

`

    const findsByLayer = new Map()
    finds?.forEach((find) => {
      const layerId = find.layerId || '未关联'
      if (!findsByLayer.has(layerId)) {
        findsByLayer.set(layerId, [])
      }
      findsByLayer.get(layerId).push(find)
    })

    findsByLayer.forEach((layerFinds, layerId) => {
      report += `
### 5.${layerId === '未关联' ? 'X' : layerId} 地层 ${layerId} 的出土物

`
      report += `
| 编号 | 名称 | 类型 | 材质 | 坐标 (X,Y,Z) |
|------|------|------|------|--------------|
`
      layerFinds.forEach((find) => {
        const coords = find.coordinates
        const coordStr = `(${coords.x ?? '-'}, ${coords.y ?? '-'}, ${coords.z ?? '-'})`
        report += `| ${find.id} | ${find.name} | ${find.type} | ${find.material} | ${coordStr} |\n`
      })
    })

    report += `
---

## 六、建议与说明

### 6.1 修复建议

1. **严重问题**: 应优先修复严重问题，这些问题可能影响地层学解释的正确性
2. **高程倒挂**: 检查测量数据，确认是否存在记录错误或特殊地质现象
3. **关系矛盾**: 核对地层关系记录，确保叠压/打破关系的一致性
4. **坐标越界**: 检查出土物坐标记录，确认是否存在测量或录入错误

### 6.2 校验规则说明

本报告基于以下规则进行校验:

- **高程校验**: 检查地层顶部高程是否大于底部高程，避免高程倒挂
- **关系校验**: 检查地层关系的一致性，避免循环引用和矛盾关系
- **坐标校验**: 检查出土物坐标是否在探方范围和所属地层范围内

---

*报告由考古探方地层可视化工具自动生成*
`

    return report
  }

  static getCategoryName(category) {
    const names = {
      'elevation': '高程校验',
      'relationship': '关系校验',
      'coordinate': '坐标校验'
    }
    return names[category] || category
  }

  static downloadReport(content, filename = 'section_report.md') {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    this.downloadBlob(blob, filename)
  }

  static downloadCSV(content, filename = 'issues.csv') {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' })
    this.downloadBlob(blob, filename)
  }

  static downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

export default ReportExporter
