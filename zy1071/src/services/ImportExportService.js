import Papa from 'papaparse'
import { Item, SystemTagLabels } from '@/models/types'
import dayjs from 'dayjs'

export class ImportExportService {
  static async importFromCSV(csvContent, project) {
    return new Promise((resolve, reject) => {
      Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const items = []
          const errors = []
          const roomMap = {}
          
          project.rooms.forEach(room => {
            roomMap[room.name] = room.id
          })
          
          results.data.forEach((row, index) => {
            try {
              if (!row.name || !row.name.trim()) {
                errors.push({ row: index + 2, message: '物品名称不能为空' })
                return
              }
              
              const item = Item.fromCSV(row, roomMap, {})
              items.push(item)
            } catch (error) {
              errors.push({ row: index + 2, message: error.message })
            }
          })
          
          resolve({ items, errors })
        },
        error: (error) => {
          reject(error)
        }
      })
    })
  }

  static async importFromJSON(jsonContent) {
    try {
      const data = JSON.parse(jsonContent)
      return { items: data.items || [], errors: [] }
    } catch (error) {
      throw new Error(`JSON解析失败: ${error.message}`)
    }
  }

  static exportMovingListCSV(project) {
    const rows = []
    
    rows.push([
      '箱号',
      '箱子名称',
      '目标房间',
      '负责人',
      '状态',
      '物品名称',
      '数量',
      '重量(kg)',
      '标签',
      '负责人',
      '备注'
    ])
    
    project.boxes.forEach(box => {
      const targetRoom = box.targetRoomId ? project.getRoomById(box.targetRoomId) : null
      const boxItems = project.getItemsByBox(box.id)
      
      if (boxItems.length === 0) {
        rows.push([
          box.boxNumber,
          box.name,
          targetRoom?.name || '',
          box.responsiblePerson || '',
          box.getCurrentStatusLabel(),
          '',
          '',
          '',
          '',
          '',
          '空箱'
        ])
      } else {
        boxItems.forEach(item => {
          rows.push([
            box.boxNumber,
            box.name,
            targetRoom?.name || '',
            box.responsiblePerson || '',
            box.getCurrentStatusLabel(),
            item.name,
            item.quantity,
            item.weight,
            item.tags.join(', '),
            item.responsiblePerson || '',
            item.description || ''
          ])
        })
      }
    })
    
    const unboxedItems = project.getUnboxedItems()
    unboxedItems.forEach(item => {
      rows.push([
        '未装箱',
        '',
        '',
        '',
        '',
        item.name,
        item.quantity,
        item.weight,
        item.tags.join(', '),
        item.responsiblePerson || '',
        item.description || ''
      ])
    })
    
    return Papa.unparse(rows)
  }

  static exportUrgentUnpackListMarkdown(project) {
    const urgentItems = []
    const fragileItems = []
    const documentItems = []
    
    project.items.forEach(item => {
      if (item.tags.includes(SystemTagLabels.urgent)) {
        const box = item.boxId ? project.getBoxById(item.boxId) : null
        urgentItems.push({
          item,
          box,
          boxNumber: box ? `#${box.boxNumber}` : '未装箱',
          status: box ? box.getCurrentStatusLabel() : ''
        })
      }
      if (item.tags.includes(SystemTagLabels.fragile)) {
        const box = item.boxId ? project.getBoxById(item.boxId) : null
        fragileItems.push({
          item,
          box,
          boxNumber: box ? `#${box.boxNumber}` : '未装箱'
        })
      }
      if (item.tags.includes(SystemTagLabels.document)) {
        const box = item.boxId ? project.getBoxById(item.boxId) : null
        documentItems.push({
          item,
          box,
          boxNumber: box ? `#${box.boxNumber}` : '未装箱'
        })
      }
    })
    
    let md = `# ${project.name} - 今晚先拆清单\n\n`
    md += `生成时间: ${dayjs().format('YYYY-MM-DD HH:mm')}\n\n`
    md += `---\n\n`
    
    if (urgentItems.length > 0) {
      md += `## 🔥 急需物品 (优先拆箱)\n\n`
      urgentItems.forEach(({ item, box, boxNumber, status }) => {
        md += `- [ ] **${item.name}** (${boxNumber} - ${status || '未装箱'})\n`
        if (item.description) {
          md += `  - 备注: ${item.description}\n`
        }
        if (item.responsiblePerson) {
          md += `  - 负责人: ${item.responsiblePerson}\n`
        }
        md += `\n`
      })
    }
    
    if (documentItems.length > 0) {
      md += `## 📄 重要证件/文件\n\n`
      documentItems.forEach(({ item, boxNumber }) => {
        md += `- **${item.name}** (${boxNumber})\n`
        if (item.description) {
          md += `  - 备注: ${item.description}\n`
        }
        md += `\n`
      })
    }
    
    if (fragileItems.length > 0) {
      md += `## 🚨 易碎物品 (小心拆箱)\n\n`
      fragileItems.forEach(({ item, boxNumber }) => {
        md += `- **${item.name}** (${boxNumber})\n`
        if (item.cushioningNote) {
          md += `  - 缓冲说明: ${item.cushioningNote}\n`
        }
        if (item.description) {
          md += `  - 备注: ${item.description}\n`
        }
        md += `\n`
      })
    }
    
    const sealedUrgentBoxes = new Set()
    urgentItems.forEach(({ box }) => {
      if (box && ['packed', 'moved'].includes(box.status)) {
        sealedUrgentBoxes.add(box.id)
      }
    })
    
    if (sealedUrgentBoxes.size > 0) {
      md += `\n---\n\n`
      md += `## ⚠️ 特别提醒\n\n`
      md += `以下箱子包含急需物品，但已封箱。请在搬运时特别标注，优先拆箱：\n\n`
      project.boxes.forEach(box => {
        if (sealedUrgentBoxes.has(box.id)) {
          const targetRoom = box.targetRoomId ? project.getRoomById(box.targetRoomId) : null
          md += `- 箱子 **#${box.boxNumber}** ${box.name}\n`
          if (targetRoom) {
            md += `  - 目标房间: ${targetRoom.name}\n`
          }
          if (box.responsiblePerson) {
            md += `  - 负责人: ${box.responsiblePerson}\n`
          }
          md += `\n`
        }
      })
    }
    
    return md
  }

  static exportBoxLabelHTML(project, boxId) {
    const box = project.getBoxById(boxId)
    if (!box) return ''
    
    const items = project.getItemsByBox(boxId)
    const targetRoom = box.targetRoomId ? project.getRoomById(box.targetRoomId) : null
    
    const hasUrgent = items.some(i => i.tags.includes(SystemTagLabels.urgent))
    const hasFragile = items.some(i => i.tags.includes(SystemTagLabels.fragile))
    const hasValuable = items.some(i => i.tags.includes(SystemTagLabels.valuable))
    const hasDocument = items.some(i => i.tags.includes(SystemTagLabels.document))
    
    const stats = project.calculateBoxStats(boxId)
    
    const riskLevel = this.calculateBoxRiskLevel(hasUrgent, hasFragile, hasValuable, hasDocument, stats)
    
    const riskColors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444',
      critical: '#dc2626'
    }
    
    const riskLabels = {
      low: '低风险',
      medium: '中风险',
      high: '高风险',
      critical: '严重风险'
    }
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>箱子标签 #${box.boxNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      background: #f5f5f5;
    }
    .label {
      width: 80mm;
      min-height: 60mm;
      background: white;
      border: 1px solid #ddd;
      padding: 15px;
      margin: 0 auto;
      font-size: 12px;
    }
    .box-number {
      font-size: 36px;
      font-weight: bold;
      text-align: center;
      color: #1f2937;
      margin-bottom: 5px;
    }
    .box-name {
      text-align: center;
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 10px;
    }
    .divider {
      height: 1px;
      background: #e5e7eb;
      margin: 10px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }
    .info-label {
      color: #6b7280;
    }
    .info-value {
      font-weight: 500;
    }
    .risk-badge {
      text-align: center;
      padding: 5px;
      border-radius: 4px;
      margin: 10px 0;
      font-weight: bold;
    }
    .tags {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .tag {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      color: white;
    }
    .tag-urgent { background: #3b82f6; }
    .tag-fragile { background: #ef4444; }
    .tag-valuable { background: #f59e0b; }
    .tag-document { background: #10b981; }
    .items-summary {
      margin-top: 10px;
      font-size: 10px;
      color: #6b7280;
    }
    .items-list {
      margin-top: 5px;
      font-size: 10px;
      max-height: 80px;
      overflow: hidden;
    }
    .stat-row {
      display: flex;
      justify-content: space-around;
      margin-top: 10px;
      font-size: 10px;
      color: #6b7280;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .label {
        border: none;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="box-number">#${box.boxNumber}</div>
    ${box.name ? `<div class="box-name">${box.name}</div>` : ''}
    
    <div class="divider"></div>
    
    <div class="info-row">
      <span class="info-label">目标房间:</span>
      <span class="info-value">${targetRoom?.name || '未指定'}</span>
    </div>
    
    <div class="info-row">
      <span class="info-label">负责人:</span>
      <span class="info-value">${box.responsiblePerson || '未指定'}</span>
    </div>
    
    <div class="risk-badge" style="background: ${riskColors[riskLevel]}; color: white;">
      ${riskLabels[riskLevel]}
    </div>
    
    <div class="tags">
      ${hasUrgent ? '<span class="tag tag-urgent">🔥 急用</span>' : ''}
      ${hasFragile ? '<span class="tag tag-fragile">⚠️ 易碎</span>' : ''}
      ${hasValuable ? '<span class="tag tag-valuable">💎 贵重</span>' : ''}
      ${hasDocument ? '<span class="tag tag-document">📄 证件</span>' : ''}
    </div>
    
    <div class="stat-row">
      <span>${stats.totalItems}件物品</span>
      <span>${stats.totalWeight.toFixed(1)}kg</span>
      <span>${box.getCurrentStatusLabel()}</span>
    </div>
    
    ${items.length > 0 ? `
    <div class="items-summary">物品摘要:</div>
    <div class="items-list">
      ${items.slice(0, 5).map(item => `• ${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`).join('<br>')}
      ${items.length > 5 ? `<br>... 还有 ${items.length - 5} 件` : ''}
    </div>
    ` : ''}
  </div>
</body>
</html>`
  }

  static calculateBoxRiskLevel(hasUrgent, hasFragile, hasValuable, hasDocument, stats) {
    let level = 'low'
    
    if (hasFragile) level = 'medium'
    if (hasValuable) level = 'medium'
    if (hasDocument) level = 'medium'
    if (hasUrgent) level = 'high'
    
    if (hasUrgent && hasFragile) level = 'critical'
    if (hasUrgent && hasDocument) level = 'critical'
    
    if (stats.totalWeight > 15) {
      if (level === 'low') level = 'medium'
      else if (level === 'medium') level = 'high'
    }
    
    return level
  }
}

export const CSV_TEMPLATE = `name,quantity,weight,room,tags,responsiblePerson,description,cushioningNote
示例物品1,1,2.5,主卧,易碎,张三,这是一个示例物品,使用气泡膜包裹
示例物品2,3,0.5,客厅,急用,李四,三个一组的物品,
示例物品3,1,0.1,书房,证件,王五,重要文件,`
