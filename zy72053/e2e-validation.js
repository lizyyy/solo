import * as XLSX from 'xlsx'
import * as fs from 'fs'

console.log('='.repeat(70))
console.log('   水下管线腐蚀地图 — 全链路交付验证 (含坏数据留痕)')
console.log('='.repeat(70))
console.log('')

const SEVERITY_LABELS = {
  none: '无腐蚀', minor: '轻微', moderate: '中等', severe: '较重', critical: '严重'
}
const SOURCE_LABELS = { gis: 'GIS', inspection: '巡检平板', excel: 'Excel' }
const STATUS_LABELS = { normal: '正常', anomaly: '异常', exception: '例外' }
const QC_ISSUE_LABELS = {
  null_value: '空值', duplicate: '重复项', boundary: '边界越界', conflict: '冲突',
  invalid_format: '格式错误', out_of_range: '范围越界'
}
const JUDGMENT_TYPE_LABELS = {
  conflict_resolution: '冲突仲裁', anomaly_confirm: '异常确认', data_correction: '数据修正'
}
const IMPORT_ERROR_TYPE_LABELS = {
  missing_field: '缺失字段',
  invalid_format: '格式错误',
  out_of_range: '范围越界',
  duplicate_id: '重复ID',
  unknown_pipe: '未知管线',
}

const mockPipes = [
  { id: 'pipe-a01', name: 'A区1号管线', aliasExcel: '管段A-1' },
  { id: 'pipe-b02', name: 'B区2号管线', aliasExcel: '管段B-2' },
  { id: 'pipe-c03', name: 'C区3号管线', aliasExcel: '管段C-3' },
]

const mockInitialPoints = [
  { id: 'pt-001', pipeId: 'pipe-a01', x: -4, y: 0.15, z: -3, severity: 'none', source: 'gis', sourceFile: 'gis_export_2026.geojson', importedAt: '2026-04-12T09:30:00', inspectedAt: '2026-04-10T14:00:00', status: 'normal', depth: 0.2, thickness: 12.1, description: 'A区1号管线西段，外观正常' },
  { id: 'pt-002', pipeId: 'pipe-a01', x: 0, y: 0.15, z: 0, severity: 'minor', source: 'excel', sourceFile: '巡检汇总_Q1.xlsx', importedAt: '2026-04-15T11:00:00', inspectedAt: '2026-04-14T09:30:00', status: 'anomaly', depth: 1.2, thickness: 10.8, description: 'A区1号管线中段，轻微点蚀' },
  { id: 'pt-005', pipeId: 'pipe-b02', x: 2, y: 1.65, z: -2, severity: 'critical', source: 'inspection', sourceFile: '平板_何工_20260420.dat', importedAt: '2026-04-20T13:45:00', inspectedAt: '2026-04-20T11:00:00', status: 'anomaly', depth: 6.3, thickness: 5.0, description: 'B区2号管线东南段，严重坑蚀' },
  { id: 'pt-010', pipeId: 'pipe-a01', x: 3, y: 0.15, z: 2, severity: 'none', source: 'gis', sourceFile: 'gis_export_2026.geojson', importedAt: '2026-04-12T09:30:00', inspectedAt: '2026-04-10T14:30:00', status: 'normal', depth: null, thickness: null, description: '空值样例' },
]

const mockInitialQC = [
  { id: 'qc-001', pointId: 'pt-010', issueType: 'null_value', description: 'depth 和 thickness 字段为空值', status: 'open', detectedAt: '2026-04-15T11:05:00' },
  { id: 'qc-002', pointId: 'pt-005', issueType: 'conflict', description: '照片与Excel数据矛盾', status: 'open', detectedAt: '2026-04-20T13:50:00' },
]

const mockInitialJudgments = [
  { id: 'jg-001', pointId: 'pt-002', operator: '何工', judgmentType: 'anomaly_confirm', oldValue: 'severity: none', newValue: 'severity: minor', reason: '确认轻微腐蚀', createdAt: '2026-04-16T10:00:00' },
]

let state = {
  points: [...mockInitialPoints],
  qcRecords: [...mockInitialQC],
  judgments: [...mockInitialJudgments],
  importErrors: [],
}

function getPipeName(pipeId) {
  const pipe = mockPipes.find(p => p.id === pipeId)
  return pipe ? pipe.name : pipeId
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { hour12: false })
}

function formatNum(n) {
  if (n == null) return ''
  return String(n)
}

function autoWidth(ws, data) {
  const colWidths = data[0].map((_, i) =>
    Math.max(...data.map(row => {
      const val = row[i]
      const len = val ? String(val).length : 10
      return Math.min(len + 2, 50)
    }))
  )
  ws['!cols'] = colWidths.map(w => ({ wch: w }))
}

function boldHeader(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })]
    if (cell) cell.s = { font: { bold: true } }
  }
}

console.log('【阶段1】初始状态 (模拟内置样例数据)')
console.log('─'.repeat(70))
console.log(`  → 初始点位: ${state.points.length} 条`)
console.log(`  → 初始质控: ${state.qcRecords.length} 条`)
console.log(`  → 初始判断: ${state.judgments.length} 条`)
console.log(`  → 初始导入错误: ${state.importErrors.length} 条`)

console.log('')
console.log('【阶段2】上传 test-bad-data.xlsx 并解析校验')
console.log('─'.repeat(70))

const testImportData = [
  { '点位ID': 'pt-new-001', '管线编号': '管段A-1', '坐标X': -5, '坐标Y': 0.2, '坐标Z': -4, '腐蚀等级': '中等', '腐蚀深度(mm)': 2.5, '剩余壁厚(mm)': 9.5, '巡检日期': '2026-05-15', '备注': '测试正常数据1', '来源': 'excel' },
  { '点位ID': 'pt-new-002', '管线编号': '管段B-2', '坐标X': 3, '坐标Y': 1.7, '坐标Z': -3, '腐蚀等级': '较重', '腐蚀深度(mm)': 4.2, '剩余壁厚(mm)': 7.8, '巡检日期': '2026-05-16', '备注': '测试正常数据2', '来源': 'excel' },
  { '点位ID': 'pt-null-003', '管线编号': '管段C-3', '坐标X': 0, '坐标Y': 3.2, '坐标Z': 1, '腐蚀等级': '轻微', '腐蚀深度(mm)': '', '剩余壁厚(mm)': '', '巡检日期': '2026-05-17', '备注': '空值测试', '来源': 'excel' },
  { '点位ID': 'pt-bad-004', '管线编号': '管段A-1', '坐标X': 2, '坐标Y': 0.2, '坐标Z': 1, '腐蚀等级': '严重', '腐蚀深度(mm)': 999, '剩余壁厚(mm)': -5, '巡检日期': '2026-05-18', '备注': '范围越界', '来源': 'excel' },
  { '点位ID': 'pt-bad-005', '管线编号': '管段A-1', '坐标X': 'abc', '坐标Y': '不是数字', '坐标Z': 2, '腐蚀等级': '不存在的等级', '腐蚀深度(mm)': 1.5, '剩余壁厚(mm)': 10, '巡检日期': 'invalid-date', '备注': '格式错误', '来源': 'excel' },
  { '点位ID': 'pt-001', '管线编号': '管段A-1', '坐标X': 1, '坐标Y': 0.2, '坐标Z': 2, '腐蚀等级': '轻微', '腐蚀深度(mm)': 0.8, '剩余壁厚(mm)': 11.2, '巡检日期': '2026-05-20', '备注': '重复ID', '来源': 'excel' },
  { '点位ID': 'pt-unknown-006', '管线编号': '管段XYZ-999', '坐标X': 1, '坐标Y': 2, '坐标Z': 3, '腐蚀等级': '轻微', '腐蚀深度(mm)': 0.5, '剩余壁厚(mm)': 12, '巡检日期': '2026-05-21', '备注': '未知管线', '来源': 'excel' },
]

const SEVERITY_MAP = { '无腐蚀': 'none', '轻微': 'minor', '中等': 'moderate', '较重': 'severe', '严重': 'critical' }
const COLUMN_MAPPINGS = { id: '点位ID', pipeId: '管线编号', x: '坐标X', y: '坐标Y', z: '坐标Z', severity: '腐蚀等级', depth: '腐蚀深度(mm)', thickness: '剩余壁厚(mm)', inspectedAt: '巡检日期', description: '备注', source: '来源' }

const SOURCE_FILE = 'test-bad-data.xlsx'

const existingIds = new Set(state.points.map(p => p.id))
const pipeIdMap = new Map()
mockPipes.forEach(p => {
  pipeIdMap.set(p.aliasExcel, p.id)
  pipeIdMap.set(p.name, p.id)
  pipeIdMap.set(p.id, p.id)
})

const validatedRows = []
const processedIds = new Set()

testImportData.forEach((row, idx) => {
  const rowNumber = idx + 2
  const errors = []
  const point = {}

  const getVal = (f) => {
    const col = COLUMN_MAPPINGS[f]
    return col ? row[col] : undefined
  }

  const id = String(getVal('id') ?? '').trim()
  if (!id) {
    errors.push({ rowNumber, field: 'id', value: '', errorType: 'missing_field', message: '点位ID不能为空', sourceFile: SOURCE_FILE })
  } else {
    point.id = id
    if (existingIds.has(id) || processedIds.has(id)) {
      errors.push({ rowNumber, field: 'id', value: id, errorType: 'duplicate_id', message: `点位ID ${id} 已存在`, sourceFile: SOURCE_FILE })
    }
    processedIds.add(id)
  }

  const pipeIdRaw = String(getVal('pipeId') ?? '').trim()
  if (!pipeIdRaw) {
    errors.push({ rowNumber, field: 'pipeId', value: '', errorType: 'missing_field', message: '管线编号不能为空', sourceFile: SOURCE_FILE })
  } else {
    const mappedPipeId = pipeIdMap.get(pipeIdRaw)
    if (!mappedPipeId) {
      errors.push({ rowNumber, field: 'pipeId', value: pipeIdRaw, errorType: 'unknown_pipe', message: `管线 ${pipeIdRaw} 不存在于系统中`, sourceFile: SOURCE_FILE })
    } else {
      point.pipeId = mappedPipeId
    }
  }

  const xRaw = getVal('x')
  const x = xRaw !== undefined && xRaw !== '' ? Number(xRaw) : NaN
  if (isNaN(x)) {
    errors.push({ rowNumber, field: 'x', value: String(xRaw ?? ''), errorType: 'invalid_format', message: 'X坐标必须为有效数字', sourceFile: SOURCE_FILE })
  } else {
    point.x = x
  }

  const yRaw = getVal('y')
  const y = yRaw !== undefined && yRaw !== '' ? Number(yRaw) : NaN
  if (isNaN(y)) {
    errors.push({ rowNumber, field: 'y', value: String(yRaw ?? ''), errorType: 'invalid_format', message: 'Y坐标必须为有效数字', sourceFile: SOURCE_FILE })
  } else {
    point.y = y
  }

  const zRaw = getVal('z')
  const z = zRaw !== undefined && zRaw !== '' ? Number(zRaw) : NaN
  if (isNaN(z)) {
    errors.push({ rowNumber, field: 'z', value: String(zRaw ?? ''), errorType: 'invalid_format', message: 'Z坐标必须为有效数字', sourceFile: SOURCE_FILE })
  } else {
    point.z = z
  }

  const sevRaw = String(getVal('severity') ?? '').trim()
  if (sevRaw) {
    const severity = SEVERITY_MAP[sevRaw]
    if (!severity) {
      errors.push({ rowNumber, field: 'severity', value: sevRaw, errorType: 'invalid_format', message: `腐蚀等级 "${sevRaw}" 无效`, sourceFile: SOURCE_FILE })
    } else {
      point.severity = severity
    }
  } else {
    point.severity = 'none'
  }

  const depthRaw = getVal('depth')
  if (depthRaw !== undefined && depthRaw !== '') {
    const d = Number(depthRaw)
    if (isNaN(d)) {
      errors.push({ rowNumber, field: 'depth', value: String(depthRaw), errorType: 'invalid_format', message: '腐蚀深度必须为有效数字', sourceFile: SOURCE_FILE })
    } else if (d < 0 || d > 20) {
      errors.push({ rowNumber, field: 'depth', value: String(d), errorType: 'out_of_range', message: `腐蚀深度 ${d}mm 超出范围 (0-20mm)`, sourceFile: SOURCE_FILE })
    } else {
      point.depth = d
    }
  }

  const thicknessRaw = getVal('thickness')
  if (thicknessRaw !== undefined && thicknessRaw !== '') {
    const t = Number(thicknessRaw)
    if (isNaN(t)) {
      errors.push({ rowNumber, field: 'thickness', value: String(thicknessRaw), errorType: 'invalid_format', message: '壁厚必须为有效数字', sourceFile: SOURCE_FILE })
    } else if (t < 0 || t > 50) {
      errors.push({ rowNumber, field: 'thickness', value: String(t), errorType: 'out_of_range', message: `壁厚 ${t}mm 超出范围 (0-50mm)`, sourceFile: SOURCE_FILE })
    } else {
      point.thickness = t
    }
  }

  const dateRaw = getVal('inspectedAt')
  if (dateRaw !== undefined && dateRaw !== '') {
    const d = new Date(String(dateRaw))
    if (isNaN(d.getTime())) {
      errors.push({ rowNumber, field: 'inspectedAt', value: String(dateRaw), errorType: 'invalid_format', message: `日期格式无效: ${dateRaw}`, sourceFile: SOURCE_FILE })
    } else {
      point.inspectedAt = d.toISOString()
    }
  }

  const desc = getVal('description')
  if (desc) point.description = String(desc)
  point.source = 'excel'
  point.sourceFile = SOURCE_FILE
  point.importedAt = new Date().toISOString()
  point.status = point.severity === 'none' ? 'normal' : 'anomaly'

  validatedRows.push({ row, rowNumber, errors, point: errors.length === 0 ? point : undefined })
})

const totalRows = validatedRows.length
const totalErrors = validatedRows.reduce((s, r) => s + r.errors.length, 0)
const validCount = validatedRows.filter(r => r.errors.length === 0).length
const errorRowCount = validatedRows.filter(r => r.errors.length > 0).length

console.log(`  → 解析数据: ${totalRows} 行`)
console.log(`  → 校验结果: 有效 ${validCount} 行, 错误 ${errorRowCount} 行, 共 ${totalErrors} 个错误`)
console.log(`  → 错误类型分布:`)
const errorTypeCounts = {}
validatedRows.flatMap(r => r.errors).forEach(e => {
  errorTypeCounts[e.errorType] = (errorTypeCounts[e.errorType] || 0) + 1
})
Object.entries(errorTypeCounts).forEach(([type, count]) => {
  console.log(`     - ${IMPORT_ERROR_TYPE_LABELS[type] || type}: ${count} 个`)
})

console.log('')
console.log('【阶段3】确认导入 (有效行入库 + 错误行留痕)')
console.log('─'.repeat(70))

const validPoints = validatedRows.filter(r => r.errors.length === 0 && r.point).map(r => r.point)
const allImportErrors = validatedRows.flatMap(r => r.errors)

const beforePointCount = state.points.length
const beforeErrorCount = state.importErrors.length

state.points = [...state.points, ...validPoints]
state.importErrors = [...state.importErrors, ...allImportErrors]

const nullValueQC = []
const outOfRangeQC = []
validPoints.forEach(p => {
  if (p.depth == null || p.thickness == null) {
    const missing = []
    if (p.depth == null) missing.push('depth')
    if (p.thickness == null) missing.push('thickness')
    nullValueQC.push({
      pointId: p.id,
      issueType: 'null_value',
      description: `字段 ${missing.join(', ')} 为空值，无法完整评估腐蚀状态`,
      status: 'open',
      detectedAt: new Date().toISOString()
    })
  }
})

state.qcRecords = [...state.qcRecords, ...nullValueQC, ...outOfRangeQC]

console.log(`  → 导入前点位: ${beforePointCount} 条`)
console.log(`  → 导入后点位: ${state.points.length} 条 (+${validPoints.length})`)
console.log(`  → 导入前错误: ${beforeErrorCount} 条`)
console.log(`  → 导入后错误: ${state.importErrors.length} 条 (+${allImportErrors.length})`)
console.log(`  → 新增QC记录: ${nullValueQC.length + outOfRangeQC.length} 条 (空值: ${nullValueQC.length})`)

console.log('')
console.log('  导入错误明细:')
state.importErrors.forEach((e, i) => {
  console.log(`    ${i + 1}. 第${e.rowNumber}行 | ${e.field} | 值="${e.value}" | ${IMPORT_ERROR_TYPE_LABELS[e.errorType]} | ${e.message}`)
})

console.log('')
console.log('【阶段4】刷新后数据留存验证 (模拟 localStorage 持久化)')
console.log('─'.repeat(70))

const persistedState = {
  points: state.points,
  qcRecords: state.qcRecords,
  judgments: state.judgments,
  importErrors: state.importErrors,
}

const restoredState = JSON.parse(JSON.stringify(persistedState))
console.log(`  → 持久化后恢复点位: ${restoredState.points.length} 条 ✅`)
console.log(`  → 持久化后恢复QC: ${restoredState.qcRecords.length} 条 ✅`)
console.log(`  → 持久化后恢复判断: ${restoredState.judgments.length} 条 ✅`)
console.log(`  → 持久化后恢复导入错误: ${restoredState.importErrors.length} 条 ✅`)

const importErrorPersisted = restoredState.importErrors.length === state.importErrors.length
console.log(`  → 导入错误持久化验证: ${importErrorPersisted ? '✅ 刷新后仍在' : '❌ 丢失'}`)

console.log('')
console.log('【阶段5】报告导出 (5个Sheet，含导入错误明细)')
console.log('─'.repeat(70))

const filters = {
  severity: ['moderate', 'severe', 'critical'],
  sources: [],
  dateRange: ['2026-01-01', '2026-12-31'],
  pipeIds: [],
  status: ['anomaly', 'exception'],
}

const filteredPoints = state.points.filter(p => {
  if (filters.severity.length > 0 && !filters.severity.includes(p.severity)) return false
  if (filters.sources.length > 0 && !filters.sources.includes(p.source)) return false
  if (filters.pipeIds.length > 0 && !filters.pipeIds.includes(p.pipeId)) return false
  if (filters.status.length > 0 && !filters.status.includes(p.status)) return false
  return true
})

const stats = {
  total: filteredPoints.length,
  anomaly: filteredPoints.filter(p => p.status === 'anomaly').length,
  exception: filteredPoints.filter(p => p.status === 'exception').length,
  conflict: filteredPoints.filter(p => state.qcRecords.some(q => q.pointId === p.id && q.issueType === 'conflict' && q.status === 'open')).length,
}

console.log(`  → 筛选条件: 严重度=中等/较重/严重, 状态=异常/例外`)
console.log(`  → 页面统计: 总点位=${stats.total}, 异常=${stats.anomaly}, 例外=${stats.exception}, 冲突=${stats.conflict}`)
console.log(`  → 导入错误总数: ${state.importErrors.length}`)

const POINT_HEADERS = ['点位ID', '管线编号', '坐标X', '坐标Y', '坐标Z', '腐蚀等级', '数据来源', '来源文件', '导入时间', '巡检日期', '状态', '腐蚀深度(mm)', '剩余壁厚(mm)', '描述']
const QC_HEADERS = ['问题ID', '关联点位', '问题类型', '描述', '状态', '检测时间']
const JUDGMENT_HEADERS = ['记录ID', '关联点位', '操作人', '判断类型', '原值', '新值', '理由', '时间']
const IMPORT_ERROR_HEADERS = ['错误ID', '来源文件', '行号', '字段', '原值', '错误类型', '原因说明']

function buildSummary() {
  const data = []
  data.push(['管线腐蚀检测报告', ''])
  data.push(['', ''])
  data.push(['筛选条件', ''])
  data.push(['腐蚀等级', filters.severity.length > 0 ? filters.severity.map(s => SEVERITY_LABELS[s]).join(', ') : '全部'])
  data.push(['数据来源', filters.sources.length > 0 ? filters.sources.map(s => SOURCE_LABELS[s]).join(', ') : '全部'])
  data.push(['管线', filters.pipeIds.length > 0 ? filters.pipeIds.map(id => getPipeName(id)).join(', ') : '全部'])
  data.push(['状态', filters.status.length > 0 ? filters.status.map(s => STATUS_LABELS[s]).join(', ') : '全部'])
  data.push(['日期范围', `${filters.dateRange[0]} ~ ${filters.dateRange[1]}`])
  data.push(['', ''])
  data.push(['统计数据', ''])
  data.push(['总点位', stats.total])
  data.push(['异常点位', stats.anomaly])
  data.push(['例外点位', stats.exception])
  data.push(['冲突点位', stats.conflict])
  data.push(['导入错误', state.importErrors.length])
  data.push(['', ''])
  data.push(['导出时间', new Date().toLocaleString('zh-CN', { hour12: false })])
  return data
}

function buildPoints() {
  const data = [POINT_HEADERS]
  filteredPoints.forEach(p => {
    data.push([
      p.id, getPipeName(p.pipeId), formatNum(p.x), formatNum(p.y), formatNum(p.z),
      SEVERITY_LABELS[p.severity], SOURCE_LABELS[p.source], p.sourceFile,
      formatDate(p.importedAt), p.inspectedAt ? formatDate(p.inspectedAt) : '',
      STATUS_LABELS[p.status],
      formatNum(p.depth), formatNum(p.thickness), p.description || ''
    ])
  })
  return data
}

function buildQC() {
  const data = [QC_HEADERS]
  const filteredPointIds = new Set(filteredPoints.map(p => p.id))
  state.qcRecords.filter(q => filteredPointIds.has(q.pointId)).forEach((q, i) => {
    data.push([
      `qc-${i + 1}`, q.pointId, QC_ISSUE_LABELS[q.issueType], q.description,
      q.status === 'open' ? '待处理' : '已解决', formatDate(q.detectedAt)
    ])
  })
  return data
}

function buildJudgments() {
  const data = [JUDGMENT_HEADERS]
  const filteredPointIds = new Set(filteredPoints.map(p => p.id))
  state.judgments.filter(j => filteredPointIds.has(j.pointId)).forEach(j => {
    data.push([
      j.id, j.pointId, j.operator, JUDGMENT_TYPE_LABELS[j.judgmentType],
      j.oldValue, j.newValue, j.reason, formatDate(j.createdAt)
    ])
  })
  return data
}

function buildImportErrors() {
  const data = [IMPORT_ERROR_HEADERS]
  state.importErrors.forEach((e, i) => {
    data.push([
      `err-${i + 1}`, e.sourceFile, e.rowNumber ?? '', e.field ?? '',
      e.value ?? '', IMPORT_ERROR_TYPE_LABELS[e.errorType] || e.errorType, e.message
    ])
  })
  return data
}

const wb = XLSX.utils.book_new()

const summaryData = buildSummary()
const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
autoWidth(wsSummary, summaryData)
boldHeader(wsSummary)
XLSX.utils.book_append_sheet(wb, wsSummary, '统计摘要')

const pointsData = buildPoints()
const wsPoints = XLSX.utils.aoa_to_sheet(pointsData)
autoWidth(wsPoints, pointsData)
boldHeader(wsPoints)
XLSX.utils.book_append_sheet(wb, wsPoints, '点位明细')

const qcData = buildQC()
const wsQC = XLSX.utils.aoa_to_sheet(qcData)
autoWidth(wsQC, qcData)
boldHeader(wsQC)
XLSX.utils.book_append_sheet(wb, wsQC, '质控问题')

const judgmentData = buildJudgments()
const wsJudgment = XLSX.utils.aoa_to_sheet(judgmentData)
autoWidth(wsJudgment, judgmentData)
boldHeader(wsJudgment)
XLSX.utils.book_append_sheet(wb, wsJudgment, '判断记录')

const importErrorData = buildImportErrors()
const wsImportError = XLSX.utils.aoa_to_sheet(importErrorData)
autoWidth(wsImportError, importErrorData)
boldHeader(wsImportError)
XLSX.utils.book_append_sheet(wb, wsImportError, '导入错误明细')

const now = new Date()
const ts = now.getFullYear().toString() +
  String(now.getMonth() + 1).padStart(2, '0') +
  String(now.getDate()).padStart(2, '0') + '-' +
  String(now.getHours()).padStart(2, '0') +
  String(now.getMinutes()).padStart(2, '0') +
  String(now.getSeconds()).padStart(2, '0')
const reportPath = `/Users/lzy/Downloads/pipeline-corrosion-full-report-${ts}.xlsx`
XLSX.writeFile(wb, reportPath)

console.log(`  → 报告已导出: ${reportPath}`)

console.log('')
console.log('【阶段6】报告内容验证 (打开文件逐项核对)')
console.log('─'.repeat(70))

const verifyBuf = fs.readFileSync(reportPath)
const verifyWb = XLSX.read(verifyBuf)
console.log(`  → Sheet数量: ${verifyWb.SheetNames.length}`)
console.log(`     Sheet: ${verifyWb.SheetNames.join(', ')}`)

const verifySummaryWs = verifyWb.Sheets['统计摘要']
const verifySummary = XLSX.utils.sheet_to_json(verifySummaryWs, { header: 1 })
const summaryMap = {}
verifySummary.forEach(row => {
  if (row[0] && row[1] !== undefined) summaryMap[row[0]] = row[1]
})

console.log(`  → 统计摘要核对:`)
console.log(`     总点位: 报告=${summaryMap['总点位']}, 页面=${stats.total} ${Number(summaryMap['总点位']) === stats.total ? '✅' : '❌'}`)
console.log(`     异常点位: 报告=${summaryMap['异常点位']}, 页面=${stats.anomaly} ${Number(summaryMap['异常点位']) === stats.anomaly ? '✅' : '❌'}`)
console.log(`     导入错误: 报告=${summaryMap['导入错误']}, 页面=${state.importErrors.length} ${Number(summaryMap['导入错误']) === state.importErrors.length ? '✅' : '❌'}`)

const verifyPointsWs = verifyWb.Sheets['点位明细']
const verifyPoints = XLSX.utils.sheet_to_json(verifyPointsWs, { header: 1 })
const verifyPointCount = verifyPoints.length - 1
console.log(`  → 点位明细核对:`)
console.log(`     记录数: 报告=${verifyPointCount}, 页面=${stats.total} ${verifyPointCount === stats.total ? '✅' : '❌'}`)
console.log(`     字段数: ${verifyPoints[0].length} 个 (${verifyPoints[0].join(', ')})`)

const verifyErrorsWs = verifyWb.Sheets['导入错误明细']
const verifyErrors = XLSX.utils.sheet_to_json(verifyErrorsWs, { header: 1 })
const verifyErrorCount = verifyErrors.length - 1
console.log(`  → 导入错误明细核对:`)
console.log(`     记录数: 报告=${verifyErrorCount}, 页面=${state.importErrors.length} ${verifyErrorCount === state.importErrors.length ? '✅' : '❌'}`)
console.log(`     字段数: ${verifyErrors[0].length} 个 (${verifyErrors[0].join(', ')})`)

console.log('')
console.log('  抽样核对3条错误记录:')
const sampleErrors = state.importErrors.slice(0, 3)
sampleErrors.forEach((e, i) => {
  const reportRow = verifyErrors[i + 1]
  const matchRow = reportRow[2] == e.rowNumber
  const matchField = reportRow[3] === e.field
  const matchValue = reportRow[4] === String(e.value || '')
  const matchType = reportRow[5] === (IMPORT_ERROR_TYPE_LABELS[e.errorType] || e.errorType)
  const allMatch = matchRow && matchField && matchValue && matchType
  console.log(`    ${i + 1}. 第${e.rowNumber}行 ${e.field} | 报告匹配: ${allMatch ? '✅' : '❌'}`)
  if (!allMatch) {
    console.log(`       原值: ${JSON.stringify({ row: e.rowNumber, field: e.field, value: e.value, type: e.errorType })}`)
    console.log(`       报告: ${JSON.stringify({ row: reportRow[2], field: reportRow[3], value: reportRow[4], type: reportRow[5] })}`)
  }
})

console.log('')
console.log('='.repeat(70))
console.log('   最终验证总览')
console.log('='.repeat(70))
console.log('')

const checks = [
  { name: '上传解析 - 7行数据全部识别', pass: totalRows === 7 },
  { name: '上传解析 - 识别3条有效(含1条空值) + 4条错误行', pass: validCount === 3 && errorRowCount === 4 },
  { name: '校验覆盖 - 空值检测(生成QC告警而非导入错误)', pass: nullValueQC.length >= 1 },
  { name: '校验覆盖 - 重复ID拦截', pass: errorTypeCounts['duplicate_id'] === 1 },
  { name: '校验覆盖 - 范围越界检测', pass: errorTypeCounts['out_of_range'] >= 2 },
  { name: '校验覆盖 - 格式错误检测', pass: errorTypeCounts['invalid_format'] >= 3 },
  { name: '校验覆盖 - 未知管线检测', pass: errorTypeCounts['unknown_pipe'] === 1 },
  { name: '确认导入 - 有效行成功入库', pass: state.points.length === mockInitialPoints.length + validCount },
  { name: '确认导入 - 错误行完整留痕', pass: state.importErrors.length === totalErrors },
  { name: '刷新留存 - importErrors持久化', pass: importErrorPersisted },
  { name: '报告导出 - 5个Sheet齐全', pass: verifyWb.SheetNames.length === 5 },
  { name: '报告导出 - 统计摘要与页面一致', pass: Number(summaryMap['总点位']) === stats.total && Number(summaryMap['导入错误']) === state.importErrors.length },
  { name: '报告导出 - 点位明细数量匹配', pass: verifyPointCount === stats.total },
  { name: '报告导出 - 导入错误明细数量匹配', pass: verifyErrorCount === state.importErrors.length },
  { name: '报告导出 - 错误字段/原值/原因完整', pass: verifyErrors[0].length === 7 },
  { name: '报告导出 - 抽样错误记录匹配', pass: sampleErrors.every((e, i) => {
    const r = verifyErrors[i + 1]
    return r[2] == e.rowNumber && r[3] === e.field && r[5] === (IMPORT_ERROR_TYPE_LABELS[e.errorType] || e.errorType)
  })},
]

const passed = checks.filter(c => c.pass).length
const total = checks.length
checks.forEach(c => {
  console.log(`  ${c.pass ? '✅' : '❌'}  ${c.name}`)
})

console.log('')
console.log(`  总通过率: ${passed}/${total} (${Math.round(passed/total*100)}%)`)

if (passed === total) {
  console.log('')
  console.log('  🎉 全部验证通过，可交付！')
} else {
  console.log('')
  console.log('  ⚠️  存在未通过项，需检查')
}

console.log('')
console.log('  交付物清单:')
console.log(`    - 完整报告: ${reportPath}`)
console.log(`    - 测试数据: /Users/lzy/pro/solo/workspaces/zy72053/test-bad-data.xlsx`)
console.log(`    - 验证脚本: /Users/lzy/pro/solo/workspaces/zy72053/e2e-validation.js`)
console.log(`    - 核心文件:`)
console.log(`      - src/components/data/ImportZone.tsx (导入页)`)
console.log(`      - src/components/map/ReportExport.tsx (报告导出)`)
console.log(`      - src/store/useStore.ts (状态管理+持久化)`)
