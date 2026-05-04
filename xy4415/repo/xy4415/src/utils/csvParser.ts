import Papa from 'papaparse'
import {
  RentalRecord,
  HumidityRecord,
  BowInspection,
  MaintenanceNote,
  ImportResult
} from '../types'
import { parseDate } from './dateUtils'

function safeString(value: any): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function safeNumber(value: any): number {
  if (value === null || value === undefined) return 0
  const num = Number(value)
  return isNaN(num) ? 0 : num
}

function parseRentalStatus(value: string): 'active' | 'returned' | 'overdue' {
  const lower = value.toLowerCase()
  if (lower === 'active' || lower === '进行中' || lower === '已借出') return 'active'
  if (lower === 'returned' || lower === '已归还') return 'returned'
  if (lower === 'overdue' || lower === '逾期') return 'overdue'
  return 'active'
}

function parseCondition(value: string): 'excellent' | 'good' | 'fair' | 'poor' {
  const lower = value.toLowerCase()
  if (lower === 'excellent' || lower === '优秀' || lower === '完好') return 'excellent'
  if (lower === 'good' || lower === '良好') return 'good'
  if (lower === 'fair' || lower === '一般' || lower === '中等') return 'fair'
  return 'poor'
}

function parseInspectionStatus(value: string): 'pass' | 'needs_maintenance' | 'fail' {
  const lower = value.toLowerCase()
  if (lower === 'pass' || lower === '通过' || lower === '合格') return 'pass'
  if (lower === 'needs_maintenance' || lower === '需维护' || lower === '需要维修') return 'needs_maintenance'
  return 'fail'
}

function parseMaintenanceStatus(value: string): 'pending' | 'in_progress' | 'completed' {
  const lower = value.toLowerCase()
  if (lower === 'pending' || lower === '待处理' || lower === '待维修') return 'pending'
  if (lower === 'in_progress' || lower === '进行中' || lower === '维修中') return 'in_progress'
  return 'completed'
}

function parseIssueType(value: string): 'bow_hair' | 'rosin' | 'bridge' | 'strings' | 'case' | 'other' {
  const lower = value.toLowerCase()
  if (lower === 'bow_hair' || lower === '弓毛') return 'bow_hair'
  if (lower === 'rosin' || lower === '松香') return 'rosin'
  if (lower === 'bridge' || lower === '琴桥' || lower === '琴马') return 'bridge'
  if (lower === 'strings' || lower === '琴弦') return 'strings'
  if (lower === 'case' || lower === '琴盒' || lower === '箱子') return 'case'
  return 'other'
}

function parseStringArray(value: any): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map(v => safeString(v))
  if (typeof value === 'string') {
    return value.split(/[,，;；]/).map(s => s.trim()).filter(s => s.length > 0)
  }
  return []
}

export function parseRentalRecordCsv(csvContent: string): ImportResult<RentalRecord> {
  const errors: string[] = []
  const data: RentalRecord[] = []
  
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true
  })
  
  if (result.errors.length > 0) {
    errors.push(...result.errors.map(e => `CSV解析错误: ${e.message}`))
  }
  
  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i] as any
    const rowNum = i + 2
    
    const id = safeString(row.id || row.ID || row.编号 || `rental_${Date.now()}_${i}`)
    const rentalId = safeString(row.rentalId || row.rental_id || row.租借单号 || row.租借ID)
    const studentId = safeString(row.studentId || row.student_id || row.学生ID || row.学号)
    const studentName = safeString(row.studentName || row.student_name || row.学生姓名 || row.姓名)
    const violinId = safeString(row.violinId || row.violin_id || row.提琴ID || row.琴号)
    const violinName = safeString(row.violinName || row.violin_name || row.提琴名称 || row.乐器名称)
    const rentDate = safeString(row.rentDate || row.rent_date || row.租借日期 || row.借出日期)
    const dueDate = safeString(row.dueDate || row.due_date || row.应还日期 || row.到期日期)
    const returnDate = safeString(row.returnDate || row.return_date || row.归还日期) || undefined
    const status = parseRentalStatus(safeString(row.status || row.状态 || 'active'))
    const notes = safeString(row.notes || row.备注) || undefined
    
    if (!studentId) {
      errors.push(`第 ${rowNum} 行: 缺少学生ID或学号`)
      continue
    }
    
    if (!studentName) {
      errors.push(`第 ${rowNum} 行: 缺少学生姓名`)
      continue
    }
    
    if (!violinId) {
      errors.push(`第 ${rowNum} 行: 缺少提琴ID或琴号`)
      continue
    }
    
    if (!rentDate) {
      errors.push(`第 ${rowNum} 行: 缺少租借日期`)
      continue
    }
    
    if (!dueDate) {
      errors.push(`第 ${rowNum} 行: 缺少应还日期`)
      continue
    }
    
    data.push({
      id,
      rentalId: rentalId || id,
      studentId,
      studentName,
      violinId,
      violinName: violinName || `提琴 ${violinId}`,
      rentDate,
      dueDate,
      returnDate,
      status,
      notes
    })
  }
  
  return {
    success: errors.length === 0 || data.length > 0,
    data,
    errors,
    count: data.length
  }
}

export function parseHumidityRecordCsv(csvContent: string): ImportResult<HumidityRecord> {
  const errors: string[] = []
  const data: HumidityRecord[] = []
  
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true
  })
  
  if (result.errors.length > 0) {
    errors.push(...result.errors.map(e => `CSV解析错误: ${e.message}`))
  }
  
  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i] as any
    const rowNum = i + 2
    
    const id = safeString(row.id || row.ID || row.编号 || `humidity_${Date.now()}_${i}`)
    const violinId = safeString(row.violinId || row.violin_id || row.提琴ID || row.琴号)
    const violinName = safeString(row.violinName || row.violin_name || row.提琴名称)
    const recordTime = safeString(row.recordTime || row.record_time || row.记录时间 || row.时间)
    const humidity = safeNumber(row.humidity || row.湿度 || row.湿度值)
    const temperature = safeNumber(row.temperature || row.温度 || row.温度值) || undefined
    const location = safeString(row.location || row.位置 || row.存放位置) || undefined
    const notes = safeString(row.notes || row.备注) || undefined
    
    if (!violinId) {
      errors.push(`第 ${rowNum} 行: 缺少提琴ID或琴号`)
      continue
    }
    
    if (!recordTime) {
      errors.push(`第 ${rowNum} 行: 缺少记录时间`)
      continue
    }
    
    if (humidity === 0 && !row.humidity && !row.湿度) {
      errors.push(`第 ${rowNum} 行: 缺少湿度值`)
      continue
    }
    
    data.push({
      id,
      violinId,
      violinName: violinName || `提琴 ${violinId}`,
      recordTime,
      humidity,
      temperature,
      location,
      notes
    })
  }
  
  return {
    success: errors.length === 0 || data.length > 0,
    data,
    errors,
    count: data.length
  }
}

export function parseBowInspectionJson(jsonContent: string): ImportResult<BowInspection> {
  const errors: string[] = []
  let data: BowInspection[] = []
  
  try {
    const parsed = JSON.parse(jsonContent)
    let rawData: any[] = []
    
    if (Array.isArray(parsed)) {
      rawData = parsed
    } else if (parsed.inspections && Array.isArray(parsed.inspections)) {
      rawData = parsed.inspections
    } else if (parsed.bowInspections && Array.isArray(parsed.bowInspections)) {
      rawData = parsed.bowInspections
    } else {
      rawData = [parsed]
    }
    
    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i]
      const rowNum = i + 1
      
      const id = safeString(item.id || item.ID || item.编号 || `inspection_${Date.now()}_${i}`)
      const violinId = safeString(item.violinId || item.violin_id || item.提琴ID || item.琴号)
      const violinName = safeString(item.violinName || item.violin_name || item.提琴名称)
      const inspectionDate = safeString(item.inspectionDate || item.inspection_date || item.点检日期 || item.检查日期)
      const bowHairCondition = parseCondition(safeString(item.bowHairCondition || item.bow_hair_condition || item.弓毛状态 || item.弓毛情况))
      const bowHairIssues = parseStringArray(item.bowHairIssues || item.bow_hair_issues || item.弓毛问题 || item.弓毛缺陷)
      const rosinCondition = parseCondition(safeString(item.rosinCondition || item.rosin_condition || item.松香状态 || item.松香情况))
      const rosinIssues = parseStringArray(item.rosinIssues || item.rosin_issues || item.松香问题 || item.松香缺陷)
      const inspector = safeString(item.inspector || item.点检人 || item.检查人 || item.检验员)
      const overallStatus = parseInspectionStatus(safeString(item.overallStatus || item.overall_status || item.总体状态 || item.总评))
      const notes = safeString(item.notes || item.备注) || undefined
      
      if (!violinId) {
        errors.push(`第 ${rowNum} 条记录: 缺少提琴ID或琴号`)
        continue
      }
      
      if (!inspectionDate) {
        errors.push(`第 ${rowNum} 条记录: 缺少点检日期`)
        continue
      }
      
      if (!inspector) {
        errors.push(`第 ${rowNum} 条记录: 缺少点检人`)
        continue
      }
      
      data.push({
        id,
        violinId,
        violinName: violinName || `提琴 ${violinId}`,
        inspectionDate,
        bowHairCondition,
        bowHairIssues,
        rosinCondition,
        rosinIssues,
        inspector,
        overallStatus,
        notes
      })
    }
  } catch (e) {
    errors.push(`JSON解析错误: ${(e as Error).message}`)
  }
  
  return {
    success: errors.length === 0 || data.length > 0,
    data: data.length > 0 ? data : undefined,
    errors,
    count: data.length
  }
}

export function parseMaintenanceNoteJson(jsonContent: string): ImportResult<MaintenanceNote> {
  const errors: string[] = []
  let data: MaintenanceNote[] = []
  
  try {
    const parsed = JSON.parse(jsonContent)
    let rawData: any[] = []
    
    if (Array.isArray(parsed)) {
      rawData = parsed
    } else if (parsed.maintenances && Array.isArray(parsed.maintenances)) {
      rawData = parsed.maintenances
    } else if (parsed.maintenanceNotes && Array.isArray(parsed.maintenanceNotes)) {
      rawData = parsed.maintenanceNotes
    } else {
      rawData = [parsed]
    }
    
    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i]
      const rowNum = i + 1
      
      const id = safeString(item.id || item.ID || item.编号 || `maintenance_${Date.now()}_${i}`)
      const violinId = safeString(item.violinId || item.violin_id || item.提琴ID || item.琴号)
      const violinName = safeString(item.violinName || item.violin_name || item.提琴名称)
      const createDate = safeString(item.createDate || item.create_date || item.创建日期 || item.登记日期)
      const issueType = parseIssueType(safeString(item.issueType || item.issue_type || item.问题类型 || item.维修类型))
      const description = safeString(item.description || item.描述 || item.问题描述 || item.维修描述)
      const status = parseMaintenanceStatus(safeString(item.status || item.状态 || 'pending'))
      const technician = safeString(item.technician || item.技师 || item.维修人) || undefined
      const completedDate = safeString(item.completedDate || item.completed_date || item.完成日期) || undefined
      const cost = safeNumber(item.cost || item.费用) || undefined
      const notes = safeString(item.notes || item.备注) || undefined
      
      if (!violinId) {
        errors.push(`第 ${rowNum} 条记录: 缺少提琴ID或琴号`)
        continue
      }
      
      if (!createDate) {
        errors.push(`第 ${rowNum} 条记录: 缺少创建日期`)
        continue
      }
      
      if (!description) {
        errors.push(`第 ${rowNum} 条记录: 缺少问题描述`)
        continue
      }
      
      data.push({
        id,
        violinId,
        violinName: violinName || `提琴 ${violinId}`,
        createDate,
        issueType,
        description,
        status,
        technician,
        completedDate,
        cost,
        notes
      })
    }
  } catch (e) {
    errors.push(`JSON解析错误: ${(e as Error).message}`)
  }
  
  return {
    success: errors.length === 0 || data.length > 0,
    data: data.length > 0 ? data : undefined,
    errors,
    count: data.length
  }
}
