import { AnnotationTypeLabels } from '../models/AnnotationType'
import { RiskLevelLabels, RiskLevelColors } from '../models/RiskLevel'
import { ShootingStageLabels } from '../models/ShootingStage'

export function generateMarkdownReport(project, annotations) {
  const createdAt = new Date().toISOString().split('T')[0]
  const projectName = project.name || '未命名项目'
  
  let markdown = `# 文物修复照片批注报告

## 项目信息

| 项目 | 内容 |
|------|------|
| **项目名称** | ${projectName} |
| **器物编号** | ${project.artifactCode || '未设置'} |
| **图片数量** | ${project.images.length} 张 |
| **批注数量** | ${annotations.length} 个 |
| **报告生成时间** | ${new Date().toLocaleString('zh-CN')} |

## 批注统计

### 按风险等级分布

| 风险等级 | 数量 |
|----------|------|
`

  // 统计各风险等级数量
  const riskStats = {}
  annotations.forEach(a => {
    riskStats[a.riskLevel] = (riskStats[a.riskLevel] || 0) + 1
  })

  const riskOrder = ['critical', 'high', 'medium', 'low']
  riskOrder.forEach(level => {
    const count = riskStats[level] || 0
    if (count > 0) {
      markdown += `| ${RiskLevelLabels[level] || level} | ${count} |\n`
    }
  })

  markdown += `
### 按类型分布

| 批注类型 | 数量 |
|----------|------|
`

  const typeStats = {}
  annotations.forEach(a => {
    typeStats[a.type] = (typeStats[a.type] || 0) + 1
  })

  Object.entries(typeStats).forEach(([type, count]) => {
    markdown += `| ${AnnotationTypeLabels[type] || type} | ${count} |\n`
  })

  markdown += `
## 详细批注列表

以下按风险等级从高到低排序：

`

  if (annotations.length === 0) {
    markdown += `> 暂无批注数据\n`
  } else {
    annotations.forEach((annotation, index) => {
      const image = annotation.image || {}
      const pos = annotation.position || {}
      
      markdown += `### 批注 #${index + 1}

| 属性 | 内容 |
|------|------|
| **批注编号** | ${annotation.id.substring(0, 8)} |
| **所属图片** | ${image.fileName || '未知图片'} |
| **器物编号** | ${image.artifactCode || '未设置'} |
| **部位** | ${image.part || '未设置'} |
| **拍摄阶段** | ${ShootingStageLabels[image.stage] || image.stage || '未设置'} |
| **批注类型** | ${AnnotationTypeLabels[annotation.type] || annotation.type} |
| **风险等级** | ${RiskLevelLabels[annotation.riskLevel] || annotation.riskLevel} |
| **位置** | X: ${Math.round(pos.x)}, Y: ${Math.round(pos.y)}, W: ${Math.round(pos.width)}, H: ${Math.round(pos.height)} |

`

      if (annotation.comment) {
        markdown += `**批注内容：**\n\n${annotation.comment}\n\n`
      }

      if (annotation.suggestion) {
        markdown += `**处理建议：**\n\n${annotation.suggestion}\n\n`
      }

      markdown += `---\n\n`
    })
  }

  markdown += `
## 附录

### 风险等级说明

| 风险等级 | 说明 |
|----------|------|
| 极高风险 | 急需处理，可能影响文物结构安全 |
| 高风险 | 需要优先处理 |
| 中风险 | 建议处理 |
| 低风险 | 可观察或后续处理 |

### 批注类型说明

| 类型 | 说明 |
|------|------|
| 裂纹 | 文物表面或内部的裂纹 |
| 补色 | 需要或已进行补色处理的区域 |
| 缺损 | 文物缺损部分 |
| 污渍 | 文物表面的污渍 |
| 孔洞 | 文物上的孔洞 |
| 其他 | 其他类型的问题 |

---

*此报告由「修复照片拼版批注台」自动生成*
*生成时间：${new Date().toISOString()}*
`

  return markdown
}

export default generateMarkdownReport
