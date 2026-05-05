import Papa from 'papaparse'
import { sampleElderlyData } from './sampleData'
import { RISK_TAGS, RISK_LEVELS } from './dataModels'
import { assessElderlyRisk } from './riskAssessment'

// 从CSV导入数据
export function importFromCsv(csvString) {
  return new Promise((resolve, reject) => {
    Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const elderlyList = results.data.map((row, index) => {
            const id = `elder_csv_${Date.now()}_${index}`
            
            return {
              id,
              name: row.姓名 || '',
              age: parseInt(row.年龄) || 0,
              gender: row.性别 || '',
              phone: row.电话 || '',
              address: row.地址 || '',
              hearingScreening: {
                id: `screening_${id}`,
                elderlyId: id,
                screeningDate: row.筛查日期 || new Date().toISOString().split('T')[0],
                leftEar: {
                  pta: parseInt(row.左耳PTA) || 0,
                  thresholds: []
                },
                rightEar: {
                  pta: parseInt(row.右耳PTA) || 0,
                  thresholds: []
                },
                speechRecognition: parseInt(row.言语识别率) || 0,
                tinnitus: row.耳鸣 === '是' || row.耳鸣 === true,
                earDischarge: row.耳漏 === '是' || row.耳漏 === true,
                notes: row.筛查备注 || ''
              },
              deviceInfo: row.设备型号 ? {
                id: `device_${id}`,
                elderlyId: id,
                model: row.设备型号 || '',
                serialNumber: row.序列号 || '',
                manufacturer: row.厂商 || '',
                purchaseDate: row.购买日期 || '',
                warrantyExpiry: row.保修到期 || '',
                batteryType: row.电池类型 || '',
                lastBatteryChange: row.上次换电池 || '',
                batteryLifeMonths: parseInt(row.电池寿命月) || 3,
                lastAdjustment: row.上次调参数 || '',
                fittingDate: row.验配日期 || '',
                notes: row.设备备注 || ''
              } : null,
              repairRecords: row.送修日期 ? [{
                id: `repair_${id}`,
                elderlyId: id,
                deviceId: `device_${id}`,
                repairDate: row.送修日期 || '',
                returnDate: row.归还日期 || null,
                problemDescription: row.维修问题 || '',
                repairActions: '',
                cost: 0,
                status: row.归还日期 ? 'completed' : 'pending',
                notes: ''
              }] : [],
              nextAppointment: row.预约日期 ? {
                id: `appointment_${id}`,
                elderlyId: id,
                date: row.预约日期 || '',
                time: row.预约时间 || '',
                type: 'follow_up',
                purpose: row.预约目的 || '定期回访',
                location: row.预约地点 || '',
                volunteer: row.志愿者 || '',
                status: 'scheduled',
                notes: ''
              } : null,
              remarks: '',
              manualOverride: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          })
          
          resolve(elderlyList)
        } catch (error) {
          reject(error)
        }
      },
      error: (error) => {
        reject(error)
      }
    })
  })
}

// 导出为CSV格式
export function exportToCsv(elderlyList) {
  const csvData = elderlyList.map(elderly => {
    const screening = elderly.hearingScreening || {}
    const device = elderly.deviceInfo || {}
    const appointment = elderly.nextAppointment || {}
    const repair = elderly.repairRecords && elderly.repairRecords.length > 0 ? elderly.repairRecords[0] : {}
    
    return {
      姓名: elderly.name,
      年龄: elderly.age,
      性别: elderly.gender,
      电话: elderly.phone,
      地址: elderly.address,
      左耳PTA: screening.leftEar?.pta || '',
      右耳PTA: screening.rightEar?.pta || '',
      言语识别率: screening.speechRecognition || '',
      耳鸣: screening.tinnitus ? '是' : '否',
      耳漏: screening.earDischarge ? '是' : '否',
      设备型号: device.model || '',
      电池类型: device.batteryType || '',
      上次换电池: device.lastBatteryChange || '',
      电池寿命月: device.batteryLifeMonths || '',
      上次调参数: device.lastAdjustment || '',
      送修日期: repair.repairDate || '',
      归还日期: repair.returnDate || '',
      预约日期: appointment.date || '',
      预约时间: appointment.time || '',
      备注: elderly.remarks || ''
    }
  })
  
  return Papa.unparse(csvData)
}

// 导出为Markdown回访清单
export function exportToMarkdown(elderlyList) {
  const today = new Date().toISOString().split('T')[0]
  let md = `# 听力服务回访清单\n\n`
  md += `生成时间：${today}\n\n`
  md += `---\n\n`
  
  const sortedList = [...elderlyList].sort((a, b) => {
    const assessmentA = assessElderlyRisk(a)
    const assessmentB = assessElderlyRisk(b)
    const levelOrder = { high: 0, medium: 1, low: 2, normal: 3 }
    return levelOrder[assessmentA.overallLevel] - levelOrder[assessmentB.overallLevel]
  })
  
  sortedList.forEach((elderly, index) => {
    const assessment = assessElderlyRisk(elderly)
    const levelEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢',
      normal: '✅'
    }
    
    md += `## ${index + 1}. ${elderly.name} ${levelEmoji[assessment.overallLevel]}\n\n`
    
    md += `### 基本信息\n\n`
    md += `- **年龄**：${elderly.age}岁\n`
    md += `- **性别**：${elderly.gender}\n`
    md += `- **电话**：${elderly.phone || '未填写'}\n`
    md += `- **地址**：${elderly.address || '未填写'}\n\n`
    
    md += `### 风险评估\n\n`
    assessment.risks.forEach(risk => {
      const tag = RISK_TAGS[risk.type] || { label: '未知' }
      md += `- **${tag.label}**：${risk.reason}\n`
    })
    md += `\n`
    
    if (elderly.deviceInfo) {
      md += `### 设备信息\n\n`
      md += `- **型号**：${elderly.deviceInfo.model || '未填写'}\n`
      md += `- **厂商**：${elderly.deviceInfo.manufacturer || '未填写'}\n`
      md += `- **电池类型**：${elderly.deviceInfo.batteryType || '未填写'}\n`
      md += `- **上次换电池**：${elderly.deviceInfo.lastBatteryChange || '未记录'}\n`
      md += `- **上次调参数**：${elderly.deviceInfo.lastAdjustment || '未记录'}\n\n`
    }
    
    if (elderly.repairRecords && elderly.repairRecords.length > 0) {
      md += `### 维修记录\n\n`
      elderly.repairRecords.forEach((record, idx) => {
        md += `#### 维修 ${idx + 1}\n`
        md += `- **送修日期**：${record.repairDate || '未填写'}\n`
        md += `- **归还日期**：${record.returnDate || '未归还'}\n`
        md += `- **问题描述**：${record.problemDescription || '未填写'}\n`
        md += `- **状态**：${record.status === 'completed' ? '已完成' : '处理中'}\n\n`
      })
    }
    
    if (elderly.nextAppointment) {
      md += `### 下次预约\n\n`
      md += `- **日期**：${elderly.nextAppointment.date || '未填写'}\n`
      md += `- **时间**：${elderly.nextAppointment.time || '未填写'}\n`
      md += `- **目的**：${elderly.nextAppointment.purpose || '未填写'}\n`
      md += `- **地点**：${elderly.nextAppointment.location || '未填写'}\n`
      md += `- **志愿者**：${elderly.nextAppointment.volunteer || '未分配'}\n\n`
    }
    
    if (elderly.remarks) {
      md += `### 志愿者备注\n\n`
      md += `${elderly.remarks}\n\n`
    }
    
    md += `---\n\n`
  })
  
  md += `\n## 统计汇总\n\n`
  const stats = {
    high: 0,
    medium: 0,
    low: 0,
    normal: 0
  }
  
  sortedList.forEach(elderly => {
    const assessment = assessElderlyRisk(elderly)
    stats[assessment.overallLevel]++
  })
  
  md += `| 风险等级 | 人数 |\n`
  md += `|----------|------|\n`
  md += `| 🔴 高风险 | ${stats.high} |\n`
  md += `| 🟡 中风险 | ${stats.medium} |\n`
  md += `| 🟢 低风险 | ${stats.low} |\n`
  md += `| ✅ 正常 | ${stats.normal} |\n`
  md += `| **总计** | **${sortedList.length}** |\n\n`
  
  return md
}

// 导出为JSON明细
export function exportToJson(elderlyList) {
  return JSON.stringify(elderlyList, null, 2)
}

// 获取示例数据
export function getSampleData() {
  return [...sampleElderlyData]
}

// 保存数据到本地存储
export async function saveToStore(data) {
  if (window.electronAPI) {
    await window.electronAPI.storeSet('hearingServiceData', data)
    return true
  }
  localStorage.setItem('hearingServiceData', JSON.stringify(data))
  return true
}

// 从本地存储加载数据
export async function loadFromStore() {
  if (window.electronAPI) {
    const data = await window.electronAPI.storeGet('hearingServiceData')
    return data || []
  }
  const data = localStorage.getItem('hearingServiceData')
  return data ? JSON.parse(data) : []
}

// 保存文件对话框
export async function saveFileDialog(defaultName, content) {
  if (window.electronAPI) {
    const result = await window.electronAPI.dialogSaveFile({
      defaultPath: defaultName,
      filters: [
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    
    if (!result.canceled && result.filePath) {
      return result.filePath
    }
    return null
  }
  
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = defaultName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  return 'downloaded'
}

// 打开文件对话框
export async function openFileDialog(extensions = ['csv', 'txt']) {
  if (window.electronAPI) {
    const result = await window.electronAPI.dialogOpenFile({
      properties: ['openFile'],
      filters: [
        { name: '数据文件', extensions }
      ]
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  }
  
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = `.${extensions.join(',.')}`
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (ev) => {
          resolve({
            name: file.name,
            content: ev.target.result
          })
        }
        reader.readAsText(file)
      } else {
        resolve(null)
      }
    }
    input.click()
  })
}
