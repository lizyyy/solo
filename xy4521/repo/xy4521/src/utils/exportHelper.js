import dayjs from 'dayjs'

export function generateMarkdownReport({ 
  samples, 
  risks, 
  remarks, 
  reviewStatus, 
  photos 
}) {
  const now = dayjs().format('YYYY年MM月DD日 HH:mm:ss')
  const totalSamples = samples.length
  const highRisks = risks.filter(r => r.level === 'high').length
  const mediumRisks = risks.filter(r => r.level === 'medium').length
  const lowRisks = risks.filter(r => r.level === 'low').length
  
  const pendingCount = samples.filter(s => !reviewStatus[s.id] || reviewStatus[s.id].status === 'pending').length
  const reviewingCount = samples.filter(s => reviewStatus[s.id]?.status === 'reviewing').length
  const completedCount = samples.filter(s => reviewStatus[s.id]?.status === 'completed').length

  let markdown = `# 茶叶审评盲样核对交接单

> 生成时间: ${now}

---

## 一、审评概览

| 项目 | 数量 |
|------|------|
| 总盲样数 | ${totalSamples} |
| 高风险项 | ${highRisks} |
| 中风险项 | ${mediumRisks} |
| 低风险项 | ${lowRisks} |
| 待复核 | ${pendingCount} |
| 复核中 | ${reviewingCount} |
| 已完成 | ${completedCount} |

---

## 二、风险检测汇总

${risks.length > 0 ? risks.map((risk, index) => `
### ${index + 1}. ${risk.title}

- **风险等级**: ${getRiskLevelText(risk.level)}
- **风险类型**: ${getRiskTypeText(risk.type)}
- **描述**: ${risk.description}

**风险证据:**

${risk.evidence.map(e => `  - ${e}`).join('\n')}

${risk.sampleIds && risk.sampleIds.length > 0 ? `**涉及盲样:** ${risk.sampleIds.map(id => {
  const sample = samples.find(s => s.id === id)
  return sample ? (sample.blindNumber || id) : id
}).join(', ')}` : ''}

`).join('') : '> 暂无风险项'}

---

## 三、盲样明细

${samples.map((sample, index) => {
  const sampleRisks = risks.filter(r => r.sampleIds && r.sampleIds.includes(sample.id))
  const samplePhotos = photos.filter(p => p.linkedSampleId === sample.id || (sample.photoIds && sample.photoIds.includes(p.id)))
  const remark = remarks[sample.id]
  const status = reviewStatus[sample.id]

  return `
### ${index + 1}. 盲样 ${sample.blindNumber || '未知'}

| 字段 | 值 |
|------|-----|
| 盲样编号 | ${sample.blindNumber || '-'} |
| 批次号 | ${sample.batchNumber || '-'} |
| 茶样名称 | ${sample.teaName || '-'} |
| 茶类 | ${sample.teaType || '-'} |
| 产地 | ${sample.origin || '-'} |
| 冲泡水温 | ${sample.brewingWaterTemp ? `${sample.brewingWaterTemp}°C` : '-'} |
| 冲泡时间 | ${sample.brewingTime ? `${sample.brewingTime}秒` : '-'} |
| 投茶量 | ${sample.teaLeafAmount ? `${sample.teaLeafAmount}g` : '-'} |
| 用水量 | ${sample.waterAmount ? `${sample.waterAmount}ml` : '-'} |
| 评委 | ${sample.judgeName || '-'} |
| 评委打分 | ${sample.judgeScore !== null && sample.judgeScore !== undefined ? sample.judgeScore : '-'} |
| 评委评语 | ${sample.judgeRemarks || '-'} |
| 审评日期 | ${sample.sampleDate || '-'} |

${sampleRisks.length > 0 ? `
**风险项 (${sampleRisks.length}项):**

${sampleRisks.map(r => `- [${getRiskLevelText(r.level)}] ${r.title}`).join('\n')}
` : ''}

**封样照片:** ${samplePhotos.length} 张
${samplePhotos.length > 0 ? samplePhotos.map(p => `- ${p.name}`).join('\n') : ''}

**复核状态:** ${status ? getStatusText(status.status) : '待复核'}

${remark ? `
**复核备注:**

${typeof remark === 'object' ? remark.content : remark}
` : ''}

`
}).join('')}

---

## 四、照片清单

| 文件名 | 大小 | 关联状态 |
|--------|------|----------|
${photos.map(photo => `| ${photo.name} | ${formatFileSize(photo.size)} | ${photo.linkedSampleId ? '已关联' : '未关联'} |`).join('\n')}

---

## 五、审计信息

- 总盲样数: ${totalSamples}
- 总风险项: ${risks.length}
- 照片总数: ${photos.length}
- 报告生成时间: ${now}

> 本报告由茶叶审评盲样核对工具自动生成
`

  return markdown
}

export function generateJSONAudit({ 
  samples, 
  risks, 
  remarks, 
  reviewStatus, 
  photos 
}) {
  const auditData = {
    auditInfo: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      tool: '茶叶审评盲样核对工具'
    },
    statistics: {
      totalSamples: samples.length,
      totalRisks: risks.length,
      totalPhotos: photos.length,
      riskBreakdown: {
        high: risks.filter(r => r.level === 'high').length,
        medium: risks.filter(r => r.level === 'medium').length,
        low: risks.filter(r => r.level === 'low').length
      },
      reviewStatus: {
        pending: samples.filter(s => !reviewStatus[s.id] || reviewStatus[s.id].status === 'pending').length,
        reviewing: samples.filter(s => reviewStatus[s.id]?.status === 'reviewing').length,
        completed: samples.filter(s => reviewStatus[s.id]?.status === 'completed').length
      }
    },
    risks: risks.map(risk => ({
      ...risk,
      affectedSamples: risk.sampleIds?.map(id => {
        const sample = samples.find(s => s.id === id)
        return {
          id: id,
          blindNumber: sample?.blindNumber,
          teaName: sample?.teaName
        }
      }) || []
    })),
    samples: samples.map(sample => {
      const sampleRisks = risks.filter(r => r.sampleIds && r.sampleIds.includes(sample.id))
      const samplePhotos = photos.filter(p => 
        p.linkedSampleId === sample.id || 
        (sample.photoIds && sample.photoIds.includes(p.id))
      )
      const remark = remarks[sample.id]
      const status = reviewStatus[sample.id]

      return {
        ...sample,
        risks: sampleRisks.map(r => ({
          id: r.id,
          title: r.title,
          level: r.level,
          type: r.type
        })),
        photos: samplePhotos.map(p => ({
          id: p.id,
          name: p.name,
          path: p.path,
          size: p.size
        })),
        reviewRemark: remark ? (typeof remark === 'object' ? remark : { content: remark, status: 'pending' }) : null,
        reviewStatus: status || null
      }
    }),
    photos: photos.map(photo => ({
      ...photo,
      linkedSample: photo.linkedSampleId ? {
        id: photo.linkedSampleId,
        blindNumber: samples.find(s => s.id === photo.linkedSampleId)?.blindNumber
      } : null
    })),
    remarks: Object.entries(remarks).map(([sampleId, remark]) => ({
      sampleId,
      sampleBlindNumber: samples.find(s => s.id === sampleId)?.blindNumber,
      ...(typeof remark === 'object' ? remark : { content: remark, status: 'pending' }),
      updatedAt: typeof remark === 'object' ? remark.updatedAt : null
    })),
    reviewStatus: Object.entries(reviewStatus).map(([sampleId, status]) => ({
      sampleId,
      sampleBlindNumber: samples.find(s => s.id === sampleId)?.blindNumber,
      ...status
    }))
  }

  return JSON.stringify(auditData, null, 2)
}

function getRiskLevelText(level) {
  switch (level) {
    case 'high': return '高风险'
    case 'medium': return '中风险'
    case 'low': return '低风险'
    default: return '未知'
  }
}

function getRiskTypeText(type) {
  const types = {
    number_leak: '编号泄露',
    duplicate_batch: '重复批次',
    inconsistent_brewing: '冲泡参数不一致',
    missing_photo: '照片缺失',
    missing_score: '打分缺失',
    missing_params: '参数缺失',
    duplicate_blind_number: '盲样编号重复'
  }
  return types[type] || '未知类型'
}

function getStatusText(status) {
  switch (status) {
    case 'pending': return '待复核'
    case 'reviewing': return '复核中'
    case 'completed': return '已完成'
    default: return '待复核'
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
