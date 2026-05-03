import { createMedicine, createFamilyMember, generateId } from './models'
import { 
  getFamilyMembers, 
  getMedicines, 
  getMedicationPlans,
  importAllData,
  exportAllData
} from './storage'
import { APPLICABLE_POPULATION, AGE_GROUP, MEAL_TIMING } from './constants'
import { getTodayString, formatDate, isDateInRange } from './dateUtils'
import { runAllChecks, CATEGORY_LABELS } from './rulesEngine'

export function downloadFile(content, filename, mimeType = 'application/json') {
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

export function exportToJSON() {
  const data = exportAllData()
  const content = JSON.stringify(data, null, 2)
  const filename = `family-medicine-backup-${getTodayString()}.json`
  downloadFile(content, filename, 'application/json')
  return true
}

export function importFromJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString)
    return importAllData(data)
  } catch (e) {
    console.error('JSON import failed:', e)
    return false
  }
}

export function parseCSV(csvString) {
  const lines = csvString.trim().split('\n')
  if (lines.length < 2) return []
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const result = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === 0) continue
    
    const obj = {}
    headers.forEach((header, index) => {
      if (index < values.length) {
        obj[header] = values[index]
      }
    })
    result.push(obj)
  }
  
  return result
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]
    
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current.trim())
  
  return result
}

export function convertCSVToMedicines(csvData) {
  return csvData.map(row => {
    const medicine = {
      id: generateId(),
      name: row['药名'] || row['name'] || row['药品名称'] || '',
      genericIngredient: row['通用成分'] || row['成分'] || row['genericingredient'] || '',
      specifications: row['规格'] || row['specifications'] || '',
      stockQuantity: parseInt(row['库存数量'] || row['stock'] || row['stockquantity'] || '0', 10) || 0,
      expiryDate: row['有效期'] || row['expiry'] || row['expirydate'] || '',
      suggestedInterval: parseInt(row['建议间隔'] || row['间隔'] || row['interval'] || '4', 10) || 4,
      notes: row['备注'] || row['notes'] || ''
    }
    
    const applicablePop = row['适用人群'] || row['适用'] || row['applicable'] || ''
    if (applicablePop) {
      const popMap = {
        '婴幼儿': APPLICABLE_POPULATION.INFANT,
        '儿童': APPLICABLE_POPULATION.CHILD,
        '青少年': APPLICABLE_POPULATION.TEEN,
        '成年人': APPLICABLE_POPULATION.ADULT,
        '老年人': APPLICABLE_POPULATION.ELDERLY,
        '所有': APPLICABLE_POPULATION.ALL
      }
      
      medicine.applicablePopulation = applicablePop
        .split(/[,、，]/)
        .map(s => popMap[s.trim()] || s.trim())
        .filter(Boolean)
    }
    
    const contra = row['禁忌'] || row['禁忌标签'] || row['contraindications'] || ''
    if (contra) {
      medicine.contraindications = contra
        .split(/[,、，]/)
        .map(s => s.trim())
        .filter(Boolean)
    }
    
    return createMedicine(medicine)
  })
}

export function importMedicinesFromCSV(csvString) {
  try {
    const csvData = parseCSV(csvString)
    const medicines = convertCSVToMedicines(csvData)
    return medicines
  } catch (e) {
    console.error('CSV import failed:', e)
    return []
  }
}

export function generateMarkdownChecklist() {
  const familyMembers = getFamilyMembers()
  const medicines = getMedicines()
  const medicationPlans = getMedicationPlans()
  const today = getTodayString()
  
  const checkResult = runAllChecks()
  
  let md = `# 家庭用药核对清单\n\n`
  md += `> 生成时间：${new Date().toLocaleString('zh-CN')}\n\n`
  md += `---\n\n`
  
  md += `## 📊 风险概览\n\n`
  md += `| 风险等级 | 数量 |\n|---------|------|\n`
  md += `| 🔴 高风险 | ${checkResult.statistics.high} |\n`
  md += `| 🟡 中风险 | ${checkResult.statistics.medium} |\n`
  md += `| 🟢 低风险 | ${checkResult.statistics.low} |\n`
  md += `| **总计** | **${checkResult.statistics.total}** |\n\n`
  
  if (checkResult.risks.length > 0) {
    md += `## ⚠️ 风险明细\n\n`
    
    const levelIcons = {
      'high': '🔴',
      'medium': '🟡',
      'low': '🟢'
    }
    
    checkResult.risks.forEach((risk, index) => {
      const icon = levelIcons[risk.level] || '⚠️'
      const category = CATEGORY_LABELS[risk.category] || risk.category
      
      md += `### ${icon} ${risk.title}\n\n`
      md += `- **风险等级**：${risk.level === 'high' ? '高' : risk.level === 'medium' ? '中' : '低'}\n`
      md += `- **风险类型**：${category}\n`
      md += `- **详细说明**：${risk.description}\n\n`
    })
  }
  
  md += `---\n\n`
  md += `## 👨‍👩‍👧‍👦 家庭成员\n\n`
  
  familyMembers.forEach(member => {
    md += `### ${member.name}\n\n`
    md += `- **年龄**：${member.age}岁\n`
    md += `- **过敏**：${member.allergies.length > 0 ? member.allergies.join('、') : '无'}\n`
    md += `- **慢病**：${member.chronicConditions.length > 0 ? member.chronicConditions.join('、') : '无'}\n`
    if (member.notes) {
      md += `- **备注**：${member.notes}\n`
    }
    md += '\n'
  })
  
  md += `---\n\n`
  md += `## 💊 药品库存\n\n`
  
  md += `| 药品名称 | 成分 | 规格 | 库存 | 有效期 | 适用人群 |\n`
  md += `|---------|------|------|------|--------|----------|\n`
  
  medicines.forEach(med => {
    const applicable = med.applicablePopulation || []
    const applicableText = applicable.length > 0 ? applicable.join('、') : '所有人群'
    
    md += `| ${med.name} | ${med.genericIngredient || '-'} | ${med.specifications || '-'} | `
    md += `${med.stockQuantity} | ${med.expiryDate || '-'} | ${applicableText} |\n`
  })
  
  md += '\n---\n\n'
  md += `## 📋 当前用药计划\n\n`
  
  const activePlans = medicationPlans.filter(plan => 
    isDateInRange(today, plan.startDate, plan.endDate)
  )
  
  if (activePlans.length === 0) {
    md += `暂无进行中的用药计划。\n\n`
  } else {
    const memberPlans = {}
    activePlans.forEach(plan => {
      if (!memberPlans[plan.familyMemberId]) {
        memberPlans[plan.familyMemberId] = []
      }
      memberPlans[plan.familyMemberId].push(plan)
    })
    
    Object.entries(memberPlans).forEach(([memberId, plans]) => {
      const member = familyMembers.find(m => m.id === memberId)
      if (!member) return
      
      md += `### ${member.name}\n\n`
      
      plans.forEach(plan => {
        const medicine = medicines.find(m => m.id === plan.medicineId)
        if (!medicine) return
        
        const timingMap = {
          'before': '饭前',
          'after': '饭后',
          'any': '不限'
        }
        
        md += `#### ${medicine.name}\n\n`
        md += `- **剂量**：${plan.dosage || '请遵医嘱'}\n`
        md += `- **频率**：每日 ${plan.frequencyPerDay} 次\n`
        md += `- **时间**：${plan.doses.map(d => d.time).join('、')}\n`
        md += `- **饭前/饭后**：${timingMap[plan.mealTiming] || '不限'}\n`
        md += `- **周期**：${plan.startDate} 至 ${plan.endDate}\n`
        if (plan.notes) {
          md += `- **备注**：${plan.notes}\n`
        }
        md += '\n'
      })
    })
  }
  
  md += `---\n\n`
  md += `> 📋 此清单由家庭药箱系统自动生成，请务必咨询医生或药师确认用药方案。\n`
  
  return md
}

export function exportMarkdownChecklist() {
  const content = generateMarkdownChecklist()
  const filename = `家庭用药核对清单-${getTodayString()}.md`
  downloadFile(content, filename, 'text/markdown')
  return true
}

export function generateHTMLChecklist() {
  const familyMembers = getFamilyMembers()
  const medicines = getMedicines()
  const medicationPlans = getMedicationPlans()
  const today = getTodayString()
  const checkResult = runAllChecks()
  
  const levelColors = {
    'high': '#dc2626',
    'medium': '#d97706',
    'low': '#059669'
  }
  
  const levelBgColors = {
    'high': '#fef2f2',
    'medium': '#fffbeb',
    'low': '#f0fdf4'
  }
  
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>家庭用药核对清单</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 20px; background: #f8fafc; }
    h1 { color: #0369a1; border-bottom: 2px solid #0ea5e9; padding-bottom: 10px; }
    h2 { color: #0369a1; margin-top: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    h3 { color: #0c4a6e; }
    .risk-card { border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .risk-high { background: #fef2f2; border-left: 4px solid #dc2626; }
    .risk-medium { background: #fffbeb; border-left: 4px solid #d97706; }
    .risk-low { background: #f0fdf4; border-left: 4px solid #059669; }
    .risk-title { font-weight: bold; font-size: 1.1em; margin-bottom: 8px; }
    .risk-meta { font-size: 0.9em; color: #6b7280; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    tr:hover { background: #f8fafc; }
    .member-card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .member-name { font-size: 1.2em; font-weight: bold; color: #0c4a6e; margin-bottom: 12px; }
    .plan-item { background: #f8fafc; border-radius: 6px; padding: 16px; margin-bottom: 12px; }
    .medicine-name { font-weight: bold; color: #0369a1; margin-bottom: 8px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; margin-right: 4px; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-info { background: #e0f2fe; color: #075985; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px; margin: 20px 0; }
    .stat-card { text-align: center; padding: 16px; border-radius: 8px; }
    .stat-value { font-size: 2em; font-weight: bold; }
    .stat-label { font-size: 0.9em; color: #6b7280; margin-top: 4px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 0.9em; text-align: center; }
    .generate-time { color: #6b7280; font-size: 0.9em; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>🏥 家庭用药核对清单</h1>
  <p class="generate-time">📅 生成时间：${new Date().toLocaleString('zh-CN')}</p>
`
  
  html += `
  <h2>📊 风险概览</h2>
  <div class="stats-grid">
    <div class="stat-card" style="background: #fef2f2;">
      <div class="stat-value" style="color: #dc2626;">${checkResult.statistics.high}</div>
      <div class="stat-label">🔴 高风险</div>
    </div>
    <div class="stat-card" style="background: #fffbeb;">
      <div class="stat-value" style="color: #d97706;">${checkResult.statistics.medium}</div>
      <div class="stat-label">🟡 中风险</div>
    </div>
    <div class="stat-card" style="background: #f0fdf4;">
      <div class="stat-value" style="color: #059669;">${checkResult.statistics.low}</div>
      <div class="stat-label">🟢 低风险</div>
    </div>
    <div class="stat-card" style="background: #f1f5f9;">
      <div class="stat-value" style="color: #0369a1;">${checkResult.statistics.total}</div>
      <div class="stat-label">📋 总计</div>
    </div>
  </div>
`
  
  if (checkResult.risks.length > 0) {
    html += `<h2>⚠️ 风险明细</h2>`
    
    checkResult.risks.forEach(risk => {
      const category = CATEGORY_LABELS[risk.category] || risk.category
      html += `
        <div class="risk-card risk-${risk.level}">
          <div class="risk-title">${risk.title}</div>
          <div class="risk-meta">
            <span class="badge badge-${risk.level === 'high' ? 'danger' : risk.level === 'medium' ? 'warning' : 'success'}">
              ${risk.level === 'high' ? '高风险' : risk.level === 'medium' ? '中风险' : '低风险'}
            </span>
            <span class="badge badge-info">${category}</span>
          </div>
          <p>${risk.description}</p>
        </div>
      `
    })
  }
  
  html += `<h2>👨‍👩‍👧‍👦 家庭成员</h2>`
  familyMembers.forEach(member => {
    html += `
      <div class="member-card">
        <div class="member-name">${member.name} <span class="badge badge-info">${member.age}岁</span></div>
        <p><strong>过敏史：</strong>${member.allergies.length > 0 ? member.allergies.map(a => `<span class="badge badge-danger">${a}</span>`).join(' ') : '无'}</p>
        <p><strong>慢性病史：</strong>${member.chronicConditions.length > 0 ? member.chronicConditions.map(c => `<span class="badge badge-warning">${c}</span>`).join(' ') : '无'}</p>
        ${member.notes ? `<p><strong>备注：</strong>${member.notes}</p>` : ''}
      </div>
    `
  })
  
  html += `<h2>💊 药品库存</h2>`
  html += `
    <table>
      <thead>
        <tr>
          <th>药品名称</th>
          <th>通用成分</th>
          <th>规格</th>
          <th>库存</th>
          <th>有效期</th>
          <th>适用人群</th>
        </tr>
      </thead>
      <tbody>
  `
  
  medicines.forEach(med => {
    const applicable = med.applicablePopulation || []
    const applicableText = applicable.length > 0 ? applicable.join('、') : '所有人群'
    html += `
        <tr>
          <td><strong>${med.name}</strong></td>
          <td>${med.genericIngredient || '-'}</td>
          <td>${med.specifications || '-'}</td>
          <td><span class="badge ${med.stockQuantity === 0 ? 'badge-danger' : med.stockQuantity <= 5 ? 'badge-warning' : 'badge-success'}">${med.stockQuantity}</span></td>
          <td>${med.expiryDate || '-'}</td>
          <td>${applicableText}</td>
        </tr>
    `
  })
  
  html += `
      </tbody>
    </table>
  `
  
  html += `<h2>📋 当前用药计划</h2>`
  const activePlans = medicationPlans.filter(plan => 
    isDateInRange(today, plan.startDate, plan.endDate)
  )
  
  if (activePlans.length === 0) {
    html += `<p>暂无进行中的用药计划。</p>`
  } else {
    const memberPlans = {}
    activePlans.forEach(plan => {
      if (!memberPlans[plan.familyMemberId]) {
        memberPlans[plan.familyMemberId] = []
      }
      memberPlans[plan.familyMemberId].push(plan)
    })
    
    const timingMap = {
      'before': '饭前',
      'after': '饭后',
      'any': '不限'
    }
    
    Object.entries(memberPlans).forEach(([memberId, plans]) => {
      const member = familyMembers.find(m => m.id === memberId)
      if (!member) return
      
      html += `<h3>${member.name}</h3>`
      
      plans.forEach(plan => {
        const medicine = medicines.find(m => m.id === plan.medicineId)
        if (!medicine) return
        
        html += `
          <div class="plan-item">
            <div class="medicine-name">${medicine.name}</div>
            <p><strong>剂量：</strong>${plan.dosage || '请遵医嘱'}</p>
            <p><strong>频率：</strong>每日 ${plan.frequencyPerDay} 次 (${plan.doses.map(d => d.time).join('、')})</p>
            <p><strong>用药时间：</strong>${timingMap[plan.mealTiming] || '不限'}</p>
            <p><strong>周期：</strong>${plan.startDate} 至 ${plan.endDate}</p>
            ${plan.notes ? `<p><strong>备注：</strong>${plan.notes}</p>` : ''}
          </div>
        `
      })
    })
  }
  
  html += `
  <div class="footer">
    <p>⚠️ 此清单由家庭药箱系统自动生成，仅供参考。</p>
    <p>请务必咨询医生或药师确认用药方案。</p>
  </div>
</body>
</html>
`
  
  return html
}

export function exportHTMLChecklist() {
  const content = generateHTMLChecklist()
  const filename = `家庭用药核对清单-${getTodayString()}.html`
  downloadFile(content, filename, 'text/html')
  return true
}
