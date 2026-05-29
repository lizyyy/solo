import Papa from 'papaparse'
import type { CsvRecord, Conflict, ConflictType, FieldMapping } from '../types'

export function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function generateVersionNo(existingVersions: string[] = []): string {
  const timestamp = new Date()
  const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, '')
  let counter = 1
  let versionNo = `v${dateStr}.${counter}`
  
  while (existingVersions.includes(versionNo)) {
    counter++
    versionNo = `v${dateStr}.${counter}`
  }
  
  return versionNo
}

export function calculateFileHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

export function formatDate(date: Date): string {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function parseCsv(content: string): { headers: string[]; data: Record<string, any>[] } {
  const result = (Papa.parse as any)(content, {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8'
  })
  
  if (result.errors.length > 0) {
    throw new Error(`CSV解析错误: ${result.errors[0].message}`)
  }
  
  const headers = result.meta.fields || []
  const data = result.data as Record<string, any>[]
  
  return { headers, data }
}

export function detectConflicts(
  records: CsvRecord[],
  primaryKeyField: string,
  existingRecords: CsvRecord[] = []
): Conflict[] {
  const conflicts: Conflict[] = []
  const seenKeys = new Map<string, number[]>()
  
  records.forEach((record, index) => {
    const keyValue = String(record.rawData[primaryKeyField] || '')
    
    if (!keyValue) {
      conflicts.push(createConflict(
        record.recordId,
        'field_validation',
        `主键字段 "${primaryKeyField}" 为空值`,
        record.originalLineNo,
        record.rawData
      ))
      return
    }
    
    if (seenKeys.has(keyValue)) {
      seenKeys.get(keyValue)!.push(record.originalLineNo)
      conflicts.push(createConflict(
        record.recordId,
        'duplicate_primary_key',
        `主键值 "${keyValue}" 在文件内重复，涉及行号: ${seenKeys.get(keyValue)!.join(', ')}`,
        record.originalLineNo,
        record.rawData
      ))
    } else {
      seenKeys.set(keyValue, [record.originalLineNo])
    }
    
    const existingRecord = existingRecords.find(
      r => String(r.rawData[primaryKeyField]) === keyValue
    )
    if (existingRecord) {
      conflicts.push(createConflict(
        record.recordId,
        'duplicate_primary_key',
        `主键值 "${keyValue}" 与历史数据重复`,
        record.originalLineNo,
        {
          current: record.rawData,
          existing: existingRecord.rawData
        }
      ))
    }
  })
  
  Object.keys(records[0]?.rawData || {}).forEach(field => {
    records.forEach((record) => {
      const value = record.rawData[field]
      if (value !== undefined && value !== null && value !== '') {
        const num = Number(value)
        if (isNaN(num)) {
          conflicts.push(createConflict(
            record.recordId,
            'data_type_mismatch',
            `字段 "${field}" 值 "${value}" 不是有效的数字`,
            record.originalLineNo,
            record.rawData,
            'low'
          ))
        }
      }
    })
  })
  
  return conflicts
}

function createConflict(
  recordId: string,
  type: ConflictType,
  message: string,
  lineNo: number,
  data: Record<string, any>,
  severity: 'high' | 'medium' | 'low' = 'high'
): Conflict {
  return {
    conflictId: generateId(),
    sessionId: '',
    recordId,
    conflictType: type,
    conflictMessage: message,
    conflictingData: data,
    severity: type === 'duplicate_primary_key' ? 'high' : severity,
    status: 'open',
    originalLineNo: lineNo,
    createdAt: new Date()
  }
}

export function getConflictTypeLabel(type: ConflictType): string {
  const labels: Record<ConflictType, string> = {
    duplicate_primary_key: '主键重复',
    partial_success: '部分成功',
    rollback_scope_error: '回滚范围错误',
    field_validation: '字段验证',
    data_type_mismatch: '数据类型不匹配'
  }
  return labels[type]
}

export function getSeverityColor(severity: 'high' | 'medium' | 'low'): string {
  const colors = {
    high: 'danger',
    medium: 'warning',
    low: 'info'
  }
  return colors[severity]
}

export function autoMapFields(
  csvHeaders: string[],
  targetFields: string[]
): FieldMapping[] {
  const mappings: FieldMapping[] = []
  const fieldPatterns: Record<string, string> = {
    'id': 'id',
    '编号': 'id',
    '序号': 'id',
    'name': 'name',
    '名称': 'name',
    '姓名': 'name',
    'email': 'email',
    '邮箱': 'email',
    'date': 'date',
    '日期': 'date',
    '时间': 'date',
    'status': 'status',
    '状态': 'status',
    'amount': 'amount',
    '金额': 'amount',
    '数量': 'amount'
  }
  
  csvHeaders.forEach(header => {
    const lowerHeader = header.toLowerCase()
    let targetField = targetFields.find(f => f.toLowerCase() === lowerHeader)
    
    if (!targetField) {
      for (const [pattern, target] of Object.entries(fieldPatterns)) {
        if (lowerHeader.includes(pattern)) {
          targetField = targetFields.find(f => f.toLowerCase().includes(target))
          break
        }
      }
    }
    
    mappings.push({
      sourceField: header,
      targetField: targetField || header,
      isPrimaryKey: lowerHeader.includes('id') || lowerHeader.includes('编号') || lowerHeader.includes('序号'),
      dataType: 'string'
    })
  })
  
  return mappings
}

export function validateRollbackScope(
  scopeType: string,
  records: string[],
  allRecords: string[]
): { valid: boolean; errors: string[]; affectedCount: number } {
  const errors: string[] = []
  
  if (records.length === 0) {
    errors.push('回滚范围不能为空')
  }
  
  const outOfScope = records.filter(r => !allRecords.includes(r))
  if (outOfScope.length > 0) {
    errors.push(`${outOfScope.length} 条记录超出有效范围`)
  }
  
  if (scopeType === 'full' && records.length !== allRecords.length) {
    errors.push('全量回滚范围不完整')
  }
  
  return {
    valid: errors.length === 0,
    errors,
    affectedCount: records.length
  }
}

export function generateRecommendations(
  conflictCount: number,
  successRate: number
): string[] {
  const recommendations: string[] = []
  
  if (conflictCount > 0) {
    recommendations.push(`检测到 ${conflictCount} 个冲突需要处理`)
  }
  
  if (successRate < 0.9) {
    recommendations.push('成功率低于90%，建议检查数据质量')
  }
  
  if (conflictCount > 10) {
    recommendations.push('冲突数量较多，建议分批导入')
  }
  
  recommendations.push('建议在非业务低峰期执行正式导入')
  recommendations.push('执行前请确认已创建回滚点')
  
  return recommendations
}

export function exportToCsv(data: Record<string, any>[], filename: string) {
  const csv = Papa.unparse(data)
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
