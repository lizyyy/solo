import { ReverberationService } from '../src/services/ReverberationService.js'
import { MessageService } from '../src/services/MessageService.js'
import { ReverberationRecord } from '../src/models/ReverberationRecord.js'
import { InspectionNote } from '../src/models/InspectionNote.js'
import { SafetyThreshold } from '../src/models/SafetyThreshold.js'

console.log('🧪 开始运行室内混响时间估计系统测试\n')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`✅ ${name}`)
    passed++
  } catch (e) {
    console.log(`❌ ${name}`)
    console.log(`   错误: ${e.message}`)
    failed++
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败')
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

console.log('📦 数据模型测试')
console.log('─'.repeat(50))

test('ReverberationRecord 应该能正确创建实例', () => {
  const record = new ReverberationRecord({
    sampleTime: '2026-06-04T10:00:00',
    reverberationTime: 1.2,
    frequency: 500,
    location: '会议室A'
  })
  assert(record.id.startsWith('REC_'), 'ID 应该以 REC_ 开头')
  assert(record.reverberationTime === 1.2, '混响时间应该正确设置')
  assert(record.location === '会议室A', '地点应该正确设置')
  assert(record.batchId === null, 'batchId 默认为 null')
})

test('InspectionNote 应该能正确创建实例', () => {
  const note = new InspectionNote({
    recordId: 'REC_123',
    noteContent: '现场检查正常',
    author: '质检员小王',
    isHandwritten: true
  })
  assert(note.id.startsWith('NOTE_'), 'ID 应该以 NOTE_ 开头')
  assert(note.isHandwritten === true, '手写标记应该正确设置')
  assert(note.batchId === null, 'batchId 默认为 null')
})

test('SafetyThreshold 应该能正确判断范围', () => {
  const threshold = new SafetyThreshold({
    frequency: 500,
    minReverberationTime: 0.5,
    maxReverberationTime: 1.5,
    location: '会议室A'
  })
  assert(threshold.isWithinRange(1.0) === true, '1.0 应该在范围内')
  assert(threshold.isWithinRange(2.0) === false, '2.0 应该超出范围')
  assert(threshold.isWithinRange(0.3) === false, '0.3 应该低于范围')
})

console.log('\n🔧 核心服务测试')
console.log('─'.repeat(50))

test('应该能正确导入记录', () => {
  const service = new ReverberationService()
  const result = service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 }
  ], '质检员小王', '6月4日上午批次')
  assert(result.success.length === 1, '应该成功导入 1 条记录')
  assert(service.getRecords().length === 1, '服务中应该有 1 条记录')
  assert(result.batchId, '应该返回 batchId')
})

test('应该能检测重复导入', () => {
  const service = new ReverberationService()
  service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 }
  ], '质检员小王', '第一批次')
  const result = service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.5 }
  ], '质检员小王', '第二批次')
  assert(result.duplicates.length === 1, '应该检测到 1 条重复记录')
  assert(result.duplicates[0].existingBatchId, '应该返回重复记录所属的批次')
})

test('应该能检测采样时间缺失（半小时左右）', () => {
  const service = new ReverberationService()
  service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:45:00', location: '会议室A', frequency: 500, reverberationTime: 1.3 }
  ])
  const missing = service.getMissingTimeRecords()
  assert(missing.length === 1, '应该检测到 1 个时间缺失')
  assert(Math.round(missing[0].gapDuration) === 45, '缺失间隔应该约为 45 分钟')
  assert(missing[0].status === 'pending_review', '初始状态应该是待复核')
})

test('应该能添加补录记录并重算', () => {
  const service = new ReverberationService()
  const importResult = service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:45:00', location: '会议室A', frequency: 500, reverberationTime: 1.3 }
  ])
  
  assert(service.getMissingTimeRecords().length === 1, '补录前应该有 1 个时间缺失')
  
  const originalId = importResult.success[0].id
  
  const result = service.addSupplementRecord(
    originalId,
    { sampleTime: '2026-06-04T10:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 },
    '补录缺失数据，设备修好后重测',
    '老岑'
  )
  
  assert(result.success === true, '补录应该成功')
  assert(result.record.isSupplement === true, '应该标记为补录记录')
  assert(result.record.originalRecordId === originalId, '应该关联原始记录')
  assert(service.getRecords().length === 3, '应该有 3 条记录')
  assert(result.recalcResults, '应该返回重算结果')
})

test('补录后缺失记录状态保留（不自动归正常）', () => {
  const service = new ReverberationService()
  const importResult = service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:45:00', location: '会议室A', frequency: 500, reverberationTime: 1.3 }
  ])
  
  const missingId = service.getMissingTimeRecords()[0].id
  
  service.reviewMissingRecord(missingId, 'keep', '当时设备临时维护', '老岑')
  
  const keptMissing = service.getMissingTimeRecords().find(m => m.id === missingId)
  assert(keptMissing.status === 'kept', '保留后状态应该是 kept')
  assert(keptMissing.keepReason === '当时设备临时维护', '应该保留理由')
  assert(keptMissing.reviewedBy === '老岑', '应该有审核人')
})

test('应该能检测备注与阈值冲突', () => {
  const service = new ReverberationService()
  service.addSafetyThreshold({
    frequency: 500,
    minReverberationTime: 0.5,
    maxReverberationTime: 1.5,
    location: '会议室A'
  })
  
  const importResult = service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.8 }
  ])
  
  const result = service.addInspectionNote({
    recordId: importResult.success[0].id,
    noteContent: '现场检查正常，一切没问题',
    author: '质检员小王',
    isHandwritten: true
  })
  
  assert(result.conflicts.length === 1, '应该检测到 1 个冲突')
  assert(result.conflicts[0].type === 'note_threshold_conflict', '冲突类型应该正确')
})

test('冲突解决不自动拍板，需要人工选择', () => {
  const service = new ReverberationService()
  service.addSafetyThreshold({
    frequency: 500,
    minReverberationTime: 0.5,
    maxReverberationTime: 1.5,
    location: '会议室A'
  })
  
  const importResult = service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.8 }
  ])
  
  const noteResult = service.addInspectionNote({
    recordId: importResult.success[0].id,
    noteContent: '正常合格',
    author: '质检员小王'
  })
  
  const conflictId = noteResult.conflicts[0].id
  
  const result = service.resolveConflict(conflictId, 'confirm', '老岑')
  
  assert(result.success === true, '解决冲突应该成功')
  assert(result.conflict.status === 'confirmed', '状态应该为 confirmed')
  assert(result.conflict.resolvedBy === '老岑', '解决人应该被记录')
})

test('导出数据一致性检查（核心修复）', () => {
  const service = new ReverberationService()
  service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.3 }
  ])
  
  const checkResult = service.checkExportConsistency()
  assert(checkResult.consistent === true, '两次数据快照应该一致')
  
  const snapshot1 = service.getDataSnapshot()
  const snapshot2 = service.getDataSnapshot()
  assert(JSON.stringify(snapshot1) === JSON.stringify(snapshot2), 
         'getDataSnapshot 应该返回完全一致的数据')
})

test('应该能生成实验复盘图数据', () => {
  const service = new ReverberationService()
  service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.3 },
    { sampleTime: '2026-06-04T11:35:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 }
  ])
  
  const chartData = service.getReviewChartData()
  
  assert('labels' in chartData, '应该有标签数据')
  assert('datasets' in chartData, '应该有数据集')
  assert(chartData.datasets.length === 4, '应该有 4 个数据系列')
})

console.log('\n📦 批次管理测试')
console.log('─'.repeat(50))

test('应该能创建和管理批次', () => {
  const service = new ReverberationService()
  const batch = service.createBatch('测试批次', '测试员')
  
  assert(batch.id.startsWith('BATCH_'), '批次ID应该以 BATCH_ 开头')
  assert(batch.name === '测试批次', '批次名称应该正确')
  assert(batch.operator === '测试员', '操作人应该正确')
  assert(batch.status === 'in_progress', '初始状态应该是 in_progress')
})

test('导入记录应该关联到批次', () => {
  const service = new ReverberationService()
  const result = service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.3 }
  ], '质检员小王', '测试批次')
  
  const batch = service.getBatchById(result.batchId)
  assert(batch.recordIds.length === 2, '批次应该有 2 条记录')
  assert(batch.status === 'completed', '导入完成后批次状态应该是 completed')
})

test('历史批次和本次重传要分清', () => {
  const service = new ReverberationService()
  
  service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 }
  ], '老员工', '历史批次')
  
  const result2 = service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.5 }
  ], '新员工', '重传批次')
  
  assert(result2.duplicates.length === 1, '重传时应该检测到重复')
  assert(result2.duplicates[0].reason.includes('历史批次'), '应该指出重复来自哪个批次')
  
  const batches = service.getBatches()
  assert(batches.length === 2, '应该有 2 个批次')
  assert(batches[0].name === '重传批次', '按时间倒序排列')
  assert(batches[1].name === '历史批次', '按时间倒序排列')
})

console.log('\n📝 变更日志测试')
console.log('─'.repeat(50))

test('操作应该产生变更日志', () => {
  const service = new ReverberationService()
  service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 }
  ], '测试员', '测试批次')
  
  const logs = service.getChangeLogs()
  assert(logs.length >= 1, '应该至少有 1 条变更日志')
  assert(logs[0].operator === '测试员', '操作人应该正确')
  assert(logs[0].batchId, '应该关联到批次')
})

test('备注修改应该记录谁改了什么', () => {
  const service = new ReverberationService()
  const importResult = service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 }
  ], '测试员')
  
  const noteResult = service.addInspectionNote({
    recordId: importResult.success[0].id,
    noteContent: '初始备注',
    author: '小王'
  })
  
  const updateResult = service.updateInspectionNote(
    noteResult.note.id,
    '修改后的备注，确认正常',
    '小李'
  )
  
  assert(updateResult.success === true, '修改备注应该成功')
  
  const logs = service.getChangeLogs({ entityType: 'note', entityId: noteResult.note.id })
  assert(logs.length >= 2, '应该至少有创建和修改两次日志')
  
  const updateLog = logs.find(l => l.type === 'update')
  assert(updateLog.operator === '小李', '修改人应该被记录')
  assert(updateLog.details.oldContent === '初始备注', '应该记录旧内容')
  assert(updateLog.details.newContent === '修改后的备注，确认正常', '应该记录新内容')
})

test('缺失记录复核应该产生变更日志', () => {
  const service = new ReverberationService()
  service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:45:00', location: '会议室A', frequency: 500, reverberationTime: 1.3 }
  ])
  
  const missingId = service.getMissingTimeRecords()[0].id
  
  service.reviewMissingRecord(missingId, 'keep', '设备维护', '老岑')
  
  const logs = service.getChangeLogs({ entityType: 'missing_time', entityId: missingId })
  assert(logs.length >= 2, '应该有检测和复核日志')
  assert(logs[0].operator === '老岑', '复核人应该被记录')
})

console.log('\n📊 数据一致性测试')
console.log('─'.repeat(50))

test('getRecordDetail 应该返回完整信息', () => {
  const service = new ReverberationService()
  const importResult = service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 }
  ])
  
  const recordId = importResult.success[0].id
  
  service.addInspectionNote({
    recordId,
    noteContent: '测试备注',
    author: '测试员'
  })
  
  const detail = service.getRecordDetail(recordId)
  
  assert(detail, '应该能获取记录详情')
  assert(detail.record.id === recordId, '应该包含记录本身')
  assert(detail.notes.length === 1, '应该包含关联备注')
  assert(detail.changeLogs.length >= 1, '应该包含变更日志')
})

test('补录后明细、历史、后续结果读到同一条更新', () => {
  const service = new ReverberationService()
  const importResult = service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:45:00', location: '会议室A', frequency: 500, reverberationTime: 1.3 }
  ])
  
  const originalId = importResult.success[0].id
  
  const supplementResult = service.addSupplementRecord(
    originalId,
    { sampleTime: '2026-06-04T10:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 },
    '测试补录',
    '老岑'
  )
  
  const supplementId = supplementResult.record.id
  
  const allRecords = service.getRecords()
  const found = allRecords.find(r => r.id === supplementId)
  assert(found, '所有记录列表应该包含补录')
  
  const detail = service.getRecordDetail(originalId)
  assert(detail.supplements.length === 1, '原始记录详情应该能看到补录')
  assert(detail.supplements[0].id === supplementId, '补录ID应该一致')
  
  const history = service.getImportHistory()
  const historyItem = history.find(h => h.recordId === supplementId)
  assert(historyItem, '导入历史应该包含补录记录')
  assert(historyItem.action === 'supplement', '历史记录类型应该是 supplement')
})

test('重跑同一批材料不会多出一份', () => {
  const service = new ReverberationService()
  
  const batch1Data = [
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.3 },
    { sampleTime: '2026-06-04T11:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 }
  ]
  
  const result1 = service.importRecords(batch1Data, '测试员', '第一批')
  assert(result1.success.length === 3, '第一批应该导入 3 条')
  
  const result2 = service.importRecords(batch1Data, '测试员', '第二批')
  assert(result2.success.length === 0, '第二批重复导入应该成功 0 条')
  assert(result2.duplicates.length === 3, '第二批应该全部是重复')
  
  const allRecords = service.getRecords()
  assert(allRecords.length === 3, '总记录数应该还是 3 条，不会多出一份')
})

console.log('\n💬 消息服务测试')
console.log('─'.repeat(50))

test('应该能生成用户友好的错误提示', () => {
  const messageService = new MessageService()
  const msg = messageService.getMessage('duplicate_import')
  
  assert(msg.title === '发现重复导入', '标题应该正确')
  assert(msg.message.includes('同一时间、同一地点、同一频率'), '消息应该说人话')
  assert(msg.severity === 'warning', '严重程度应该正确')
})

test('应该能格式化导入结果为用户友好消息', () => {
  const service = new ReverberationService()
  const messageService = new MessageService()
  
  const result = service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 }
  ])
  
  const messages = messageService.formatImportResults(result)
  assert(messages.length > 0, '应该生成格式化消息')
  assert(messages[0].title === '记录验证通过', '标题应该友好')
})

test('应该能格式化冲突为用户友好展示', () => {
  const service = new ReverberationService()
  const messageService = new MessageService()
  
  service.addSafetyThreshold({
    frequency: 500,
    minReverberationTime: 0.5,
    maxReverberationTime: 1.5,
    location: '会议室A'
  })
  
  const importResult = service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.8 }
  ])
  
  const noteResult = service.addInspectionNote({
    recordId: importResult.success[0].id,
    noteContent: '正常',
    author: '质检员小王'
  })
  
  const formatted = messageService.formatConflict(noteResult.conflicts[0])
  
  assert(formatted.title === '巡检备注与阈值冲突', '标题应该友好')
  assert('evidence' in formatted, '应该包含证据')
})

console.log('\n📋 自检功能测试')
console.log('─'.repeat(50))

test('系统自检应该覆盖所有检查项', () => {
  const service = new ReverberationService()
  service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:45:00', location: '会议室A', frequency: 500, reverberationTime: 1.3 }
  ])
  
  const results = service.runSelfCheck()
  
  assert('duplicateCheck' in results, '应该包含重复检查')
  assert('missingTimeCheck' in results, '应该包含时间缺失检查')
  assert('supplementRecalcCheck' in results, '应该包含补录检查')
  assert('exportConsistencyCheck' in results, '应该包含导出一致性检查')
  assert('batchConsistencyCheck' in results, '应该包含批次一致性检查')
  assert(results.exportConsistencyCheck.consistent === true, '导出一致性应该通过')
})

console.log('\n📊 完整工作流程测试')
console.log('─'.repeat(50))

test('三步工作流应该完整执行', () => {
  const service = new ReverberationService()
  const messageService = new MessageService()
  
  service.addSafetyThreshold({
    frequency: 500,
    minReverberationTime: 0.5,
    maxReverberationTime: 1.5,
    location: '会议室A'
  })
  
  const importResult = service.importRecords([
    { sampleTime: '2026-06-04T09:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T09:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 },
    { sampleTime: '2026-06-04T10:40:00', location: '会议室A', frequency: 500, reverberationTime: 1.8 },
    { sampleTime: '2026-06-04T11:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.0 }
  ], '质检员小王', '6月4日手写巡检备注批次')
  
  assert(importResult.success.length === 4, '第一步：应该能导入所有记录')
  assert(service.getMissingTimeRecords().length === 1, '第一步：应该检测到时间缺失')
  assert(importResult.batchId, '第一步：应该有批次号')
  
  const noteResult = service.addInspectionNote({
    recordId: importResult.success[2].id,
    noteContent: '现场检查正常',
    author: '质检员小王',
    isHandwritten: true
  })
  
  assert(noteResult.conflicts.length === 1, '第二步：应该检测到备注与阈值冲突')
  
  const missing = service.getMissingTimeRecords()[0]
  service.reviewMissingRecord(missing.id, 'keep', '当时有临时会议，无法测量', '老岑')
  
  const conflict = noteResult.conflicts[0]
  service.resolveConflict(conflict.id, 'confirm', '老岑')
  
  const chartData = service.getReviewChartData()
  assert(chartData.labels.length > 0, '第三步：应该能生成复盘图数据')
  
  const selfCheck = service.runSelfCheck()
  assert(selfCheck.missingTimeCheck.hasIssues === true, '第三步：自检应该仍显示有缺失（已保留）')
  assert(selfCheck.missingTimeCheck.pendingCount === 0, '第三步：所有缺失都已处理')
})

test('按普通使用者路线完整复现', () => {
  const service = new ReverberationService()
  
  service.addSafetyThreshold({
    frequency: 500,
    minReverberationTime: 0.5,
    maxReverberationTime: 1.5,
    location: '会议室A'
  })
  
  const normalRecords = [
    { sampleTime: '2026-06-04T09:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T09:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 }
  ]
  const r1 = service.importRecords(normalRecords, '质检员小王', '正常材料批次')
  assert(r1.success.length === 2, '正常材料导入成功')
  
  const missingRecords = [
    { sampleTime: '2026-06-04T10:35:00', location: '会议室A', frequency: 500, reverberationTime: 1.3 }
  ]
  const r2 = service.importRecords(missingRecords, '质检员小王', '错口径材料批次')
  assert(r2.success.length === 1, '错口径材料导入（产生缺失）')
  
  assert(service.getMissingTimeRecords().length === 1, '应该检测到半小时左右的缺失')
  
  const supplementResult = service.addSupplementRecord(
    r1.success[1].id,
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.0 },
    '补录缺失数据',
    '老岑'
  )
  assert(supplementResult.success === true, '补录成功')
  assert(supplementResult.recalcResults, '补录后触发重算')
  
  const selfCheck = service.runSelfCheck()
  assert(selfCheck.exportConsistencyCheck.consistent === true, '导出一致性检查通过')
  assert(selfCheck.duplicateCheck.hasDuplicates === false, '无重复记录')
  assert(selfCheck.supplementRecalcCheck.hasIssues === false, '补录重算检查通过')
  
  const export1 = service.exportData()
  const export2 = service.exportData()
  assert(export1.records.length === export2.records.length, '两次导出记录数一致')
  assert(export1.records.length === 4, '总共有 4 条记录（2正常 + 1缺失 + 1补录）')
  
  const batches = service.getBatches()
  assert(batches.length >= 2, '至少有两个批次')
})

console.log('\n🔗 真实补录链路测试')
console.log('─'.repeat(50))

test('自检在无补录记录时不显示「补录正常」', () => {
  const service = new ReverberationService()
  service.importRecords([
    { sampleTime: '2026-06-04T09:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:05:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 }
  ], '质检员小王', '有缺失批次')
  assert(service.getMissingTimeRecords().length === 1, '应该产生 1 个缺失')
  
  const check = service.checkSupplementRecalculation()
  assert(check.supplementCount === 0, '补录记录数应该为 0')
  assert(check.status === 'pending_missing', `状态应该是 pending_missing，实际是 ${check.status}`)
  assert(check.warnings.length >= 1, '应该有提醒（有待处理缺失但无补录）')
})

test('补录记录必须带补录身份字段，不是普通导入伪装', () => {
  const service = new ReverberationService()
  const imp = service.importRecords([
    { sampleTime: '2026-06-04T09:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:05:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 }
  ], '质检员小王', '有缺失批次')
  const originalRecord = imp.success[0]
  const missing = service.getMissingTimeRecords()[0]

  const result = service.addSupplementRecord(
    originalRecord.id,
    { sampleTime: '2026-06-04T09:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.15 },
    '当时设备校准延误，重新补测',
    '维修师傅老岑',
    missing.id
  )
  assert(result.success === true, '补录应该成功')

  const sup = result.record
  assert(sup.isSupplement === true, '补录记录必须标记 isSupplement=true')
  assert(sup.originalRecordId === originalRecord.id, '补录记录必须绑定 originalRecordId')
  assert(sup.relatedMissingId === missing.id, '补录记录必须绑定 relatedMissingId')
  assert(sup.supplementReason === '当时设备校准延误，重新补测', '补录记录必须带补录原因')
  assert(sup.supplementedBy === '维修师傅老岑', '补录记录必须带补录人')
  assert(typeof sup.supplementTime === 'string' && sup.supplementTime.length > 0, '补录记录必须带 supplementTime')
})

test('补录保存后原始记录进入已补录状态', () => {
  const service = new ReverberationService()
  const imp = service.importRecords([
    { sampleTime: '2026-06-04T09:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:05:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 }
  ], '质检员小王', '有缺失批次')
  const originalRecord = imp.success[0]
  const missing = service.getMissingTimeRecords()[0]

  service.addSupplementRecord(
    originalRecord.id,
    { sampleTime: '2026-06-04T09:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.15 },
    '当时设备校准延误',
    '老岑',
    missing.id
  )

  const originalAfter = service.getRecordById(originalRecord.id)
  assert(originalAfter.supplementStatus === 'supplemented', `原记录状态应为 supplemented，实际是 ${originalAfter.supplementStatus}`)
  assert(originalAfter.supplementedCount === 1, `原记录补录计数应为 1，实际是 ${originalAfter.supplementedCount}`)
  assert(typeof originalAfter.lastSupplementedAt === 'string' && originalAfter.lastSupplementedAt.length > 0, '原记录必须有 lastSupplementedAt')
})

test('补录保存后缺失间隔变为已解决，双向绑定不丢失', () => {
  const service = new ReverberationService()
  const imp = service.importRecords([
    { sampleTime: '2026-06-04T09:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:05:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 }
  ], '质检员小王', '有缺失批次')
  const missingId = service.getMissingTimeRecords()[0].id
  const originalRecord = imp.success[0]

  const result = service.addSupplementRecord(
    originalRecord.id,
    { sampleTime: '2026-06-04T09:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.15 },
    '当时设备校准延误',
    '老岑',
    missingId
  )

  const missingAfter = service.getMissingTimeRecordById(missingId)
  assert(missingAfter.status === 'resolved', `缺失状态应为 resolved，实际是 ${missingAfter.status}`)
  assert(missingAfter.resolvedWith === 'supplement', `缺失解决方式应为 supplement，实际是 ${missingAfter.resolvedWith}`)
  assert(missingAfter.resolvedBy === '老岑', `缺失解决人应为老岑，实际是 ${missingAfter.resolvedBy}`)
  assert(missingAfter.supplementRecordId === result.record.id, `缺失必须反向绑定补录记录ID，关联链不能断`)
  assert(missingAfter.supplementReason === '当时设备校准延误', '缺失必须带补录原因副本')
  assert(typeof missingAfter.resolvedAt === 'string' && missingAfter.resolvedAt.length > 0, '缺失必须带 resolvedAt')
})

test('补录、重算的变更日志记录：谁改了什么、影响了哪条', () => {
  const service = new ReverberationService()
  const imp = service.importRecords([
    { sampleTime: '2026-06-04T09:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:05:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 }
  ], '质检员小王', '有缺失批次')
  const missingId = service.getMissingTimeRecords()[0].id
  const originalRecord = imp.success[0]

  const beforeLogCount = service.getChangeLogs().length
  service.addSupplementRecord(
    originalRecord.id,
    { sampleTime: '2026-06-04T09:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.15 },
    '当时设备校准延误',
    '维修师傅老岑',
    missingId
  )
  const afterLogCount = service.getChangeLogs().length
  assert(afterLogCount - beforeLogCount >= 4, `至少产生 4 条变更日志（补录创建+原记录更新+缺失review+重算），实际新增 ${afterLogCount - beforeLogCount} 条`)

  const supplementCreateLogs = service.getChangeLogs({ entityType: 'record', entityId: service.getRecords().find(r => r.isSupplement).id })
  assert(supplementCreateLogs.length >= 1, '补录记录自身应该有创建日志')
  assert(supplementCreateLogs.some(l => l.type === 'supplement'), '应该包含 type=supplement 的变更日志')
  const supLog = supplementCreateLogs.find(l => l.type === 'supplement')
  assert(supLog.operator === '维修师傅老岑', '变更日志必须记录补录人')
  assert(supLog.details.relatedMissingId === missingId, '变更日志必须记录关联缺失ID')
  assert(supLog.details.reason === '当时设备校准延误', '变更日志必须记录补录原因')

  const missingLogs = service.getChangeLogs({ entityType: 'missing_time', entityId: missingId })
  assert(missingLogs.some(l => l.type === 'review'), '缺失应该有 review 类型日志')
  const reviewLog = missingLogs.find(l => l.type === 'review')
  assert(reviewLog.details.decision === 'supplement', 'review 日志决策应为 supplement')
  assert(reviewLog.details.supplementRecordId, 'review 日志必须指向补录记录')
})

test('明细、历史、导出读到同一条补录更新', () => {
  const service = new ReverberationService()
  const imp = service.importRecords([
    { sampleTime: '2026-06-04T09:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:05:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 }
  ], '质检员小王', '有缺失批次')
  const missingId = service.getMissingTimeRecords()[0].id
  const originalRecord = imp.success[0]

  const supplementResult = service.addSupplementRecord(
    originalRecord.id,
    { sampleTime: '2026-06-04T09:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.15 },
    '当时设备校准延误',
    '老岑',
    missingId
  )
  const supplementId = supplementResult.record.id

  const detail = service.getRecordDetail(supplementId)
  assert(detail.record.isSupplement === true, '【明细】补录身份一致')
  assert(detail.record.relatedMissingId === missingId, '【明细】关联缺失ID一致')
  assert(detail.supplementSummary.supplementedBy === '老岑', '【明细】补录人一致')
  assert(detail.supplementSummary.originalRecord.id === originalRecord.id, '【明细】原始记录关联一致')

  const history = service.getImportHistory()
  const historyItem = history.find(h => h.recordId === supplementId)
  assert(historyItem, '【导入历史】补录记录存在')
  assert(historyItem.action === 'supplement', '【导入历史】action 是 supplement 不是普通 import')
  assert(historyItem.relatedMissingId === missingId, '【导入历史】关联缺失ID一致')
  assert(historyItem.originalRecordId === originalRecord.id, '【导入历史】原始记录关联一致')

  const exportData = service.exportData()
  const supInExport = exportData.records.find(r => r.id === supplementId)
  assert(supInExport, '【导出】补录记录存在')
  assert(supInExport.isSupplement === true, '【导出】补录身份一致')
  assert(supInExport.originalRecordId === originalRecord.id, '【导出】原始记录关联一致')
  assert(supInExport.relatedMissingId === missingId, '【导出】关联缺失ID一致')
  assert(supInExport.supplementedBy === '老岑', '【导出】补录人一致')
  assert(supInExport.supplementReason === '当时设备校准延误', '【导出】补录原因一致')
})

test('自检补录检查：补录前后状态真实变化，不是固定通过', () => {
  const service = new ReverberationService()
  const imp = service.importRecords([
    { sampleTime: '2026-06-04T09:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:05:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 }
  ], '质检员小王', '有缺失批次')
  const missingId = service.getMissingTimeRecords()[0].id

  const beforeSelfCheck = service.runSelfCheck()
  assert(beforeSelfCheck.supplementRecalcCheck.status === 'pending_missing', `补录前状态是 pending_missing，实际是 ${beforeSelfCheck.supplementRecalcCheck.status}`)
  assert(beforeSelfCheck.supplementRecalcCheck.supplementCount === 0, '补录前补录记录数应为 0')
  assert(beforeSelfCheck.supplementRecalcCheck.pendingMissingCount === 1, '补录前待复核缺失数应为 1')

  service.addSupplementRecord(
    imp.success[0].id,
    { sampleTime: '2026-06-04T09:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.15 },
    '设备校准后重测',
    '老岑',
    missingId
  )

  const afterSelfCheck = service.runSelfCheck()
  assert(afterSelfCheck.supplementRecalcCheck.supplementCount === 1, '补录后补录记录数应为 1')
  assert(afterSelfCheck.supplementRecalcCheck.resolvedMissingCount === 1, '补录后已补录解决缺失数应为 1')
  assert(afterSelfCheck.supplementRecalcCheck.status === 'normal' || afterSelfCheck.supplementRecalcCheck.status === 'has_warnings', `补录后状态应正常，实际是 ${afterSelfCheck.supplementRecalcCheck.status}`)
  assert(afterSelfCheck.supplementRecalcCheck.hasIssues === false, '补录后不应有严重关联断裂问题')
})

test('导出字段与明细一致，且两次导出一致（包含补录字段）', () => {
  const service = new ReverberationService()
  const imp = service.importRecords([
    { sampleTime: '2026-06-04T09:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:05:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 }
  ], '质检员小王', '有缺失批次')
  const missingId = service.getMissingTimeRecords()[0].id

  service.addSupplementRecord(
    imp.success[0].id,
    { sampleTime: '2026-06-04T09:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.15 },
    '设备校准后重测',
    '老岑',
    missingId
  )

  const snapshot1 = JSON.stringify(service.getDataSnapshot())
  const snapshot2 = JSON.stringify(service.getDataSnapshot())
  assert(snapshot1 === snapshot2, '两次数据快照内容完全一致')

  const snapshot = service.getDataSnapshot()
  const supplementInSnapshot = snapshot.records.find(r => r.isSupplement)
  assert(supplementInSnapshot.originalRecordId, '数据快照补录记录含 originalRecordId')
  assert(supplementInSnapshot.relatedMissingId, '数据快照补录记录含 relatedMissingId')
  assert(supplementInSnapshot.supplementedBy, '数据快照补录记录含 supplementedBy')
  assert(supplementInSnapshot.supplementReason, '数据快照补录记录含 supplementReason')

  const selfCheck = service.checkExportConsistency()
  assert(selfCheck.consistent === true, '导出一致性自检通过')
})

test('按普通使用者路线：真实补录缺半小时采样时间全链路复现', () => {
  const service = new ReverberationService()

  service.addSafetyThreshold({
    frequency: 500,
    minReverberationTime: 0.5,
    maxReverberationTime: 1.5,
    location: '会议室A'
  })

  const step1 = service.importRecords([
    { sampleTime: '2026-06-04T09:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T09:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.15 },
    { sampleTime: '2026-06-04T10:35:00', location: '会议室A', frequency: 500, reverberationTime: 1.3 },
    { sampleTime: '2026-06-04T11:05:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 }
  ], '质检员小王', '手写巡检备注第一次导入')
  assert(step1.success.length === 4, '第一步：导入 4 条手写巡检记录成功')

  const missingsBefore = service.getMissingTimeRecords()
  assert(missingsBefore.length === 1, '第一步：检测到 1 个缺半小时采样时间')
  assert(missingsBefore[0].status === 'pending_review', '第一步：缺失处于待复核状态')
  assert(Math.abs(missingsBefore[0].gapDuration - 65) < 1, `第一步：缺失间隔约 65 分钟（实际 ${missingsBefore[0].gapDuration.toFixed(1)}）`)

  service.addInspectionNote({
    recordId: step1.success[2].id,
    noteContent: '现场检查门窗关好，吸声材料完好',
    author: '老岑',
    isHandwritten: true
  })

  const originalRecord = missingsBefore[0].previousRecord
  const expectedTime = missingsBefore[0].expectedTime
  const missingId = missingsBefore[0].id
  const supplementData = {
    sampleTime: expectedTime,
    location: originalRecord.location,
    frequency: originalRecord.frequency,
    reverberationTime: 1.18
  }

  const step3 = service.addSupplementRecord(
    originalRecord.id,
    supplementData,
    '10点左右仪器临时校准，完成后立即补测此点',
    '维修师傅老岑',
    missingId
  )
  assert(step3.success === true, '第三步（补录解决）：补录保存成功')
  assert(step3.missingResolution.beforeStatus === 'pending_review', '第三步：缺失状态变化前 pending_review')
  assert(step3.missingResolution.afterStatus === 'resolved', '第三步：缺失状态变化后 resolved')
  assert(step3.originalRecordUpdate.supplementStatus === 'supplemented', '第三步：原记录进入已补录状态')
  assert(step3.recalcResults, '第三步：补录后自动重算')

  const detailSupplement = service.getRecordDetail(step3.record.id)
  assert(detailSupplement.record.isSupplement === true, '【核对-补录身份】是补录记录')
  assert(detailSupplement.supplementSummary.originalRecord.id === originalRecord.id, '【核对-原始记录关联】绑定正确')
  assert(detailSupplement.record.relatedMissingId === missingId, '【核对-缺失间隔】关联正确')
  assert(detailSupplement.supplementSummary.expectedTime === expectedTime, '【核对-期望采样时间】一致')
  assert(detailSupplement.record.supplementReason === '10点左右仪器临时校准，完成后立即补测此点', '【核对-补录原因】一致')
  assert(detailSupplement.record.supplementedBy === '维修师傅老岑', '【核对-补录人】一致')

  const detailOriginal = service.getRecordDetail(originalRecord.id)
  assert(detailOriginal.originalRecordSummary.supplementStatus === 'supplemented', '【核对-原记录当前状态】已补录')
  assert(detailOriginal.originalRecordSummary.supplementedCount === 1, '【核对-原记录补录次数】1 次')
  assert(detailOriginal.originalRecordSummary.supplements[0].id === step3.record.id, '【核对-原记录反向看到补录】ID 一致')

  const missingAfter = service.getMissingTimeRecordById(missingId)
  assert(missingAfter.status === 'resolved', '【核对-缺失间隔当前状态】已解决')
  assert(missingAfter.resolvedWith === 'supplement', '【核对-解决方式】补录解决')
  assert(missingAfter.resolvedBy === '维修师傅老岑', '【核对-解决人】正确')
  assert(missingAfter.supplementRecordId === step3.record.id, '【核对-缺失反向绑定补录】ID 一致')

  const allLogs = service.getChangeLogs()
  assert(allLogs.some(l => l.type === 'supplement' && l.operator === '维修师傅老岑'), '【核对-历史】有补录创建日志')
  assert(allLogs.some(l => l.type === 'review' && l.entityId === missingId && l.details.decision === 'supplement'), '【核对-历史】有缺失补录解决日志')
  assert(allLogs.some(l => l.details && l.details.cause === 'supplement_recalculation'), '【核对-历史】有补录后重算日志')

  const selfCheckFinal = service.runSelfCheck()
  assert(selfCheckFinal.exportConsistencyCheck.consistent === true, '【核对-报告和导出】导出一致通过')
  assert(selfCheckFinal.supplementRecalcCheck.supplementCount === 1, '【核对-报告和导出】补录记录数 1')
  assert(selfCheckFinal.supplementRecalcCheck.resolvedMissingCount === 1, '【核对-报告和导出】补录解决缺失数 1')
  assert(selfCheckFinal.supplementRecalcCheck.status === 'normal' || selfCheckFinal.supplementRecalcCheck.status === 'has_warnings', `【核对-报告和导出】补录链路正常，状态：${selfCheckFinal.supplementRecalcCheck.status}`)

  const exportSnapshot = service.getDataSnapshot()
  const supInExport = exportSnapshot.records.find(r => r.id === step3.record.id)
  assert(supInExport.isSupplement === true, '【核对-导出字段】补录身份 isSupplement')
  assert(supInExport.originalRecordId === originalRecord.id, '【核对-导出字段】原始记录关联 originalRecordId')
  assert(supInExport.relatedMissingId === missingId, '【核对-导出字段】缺失间隔关联 relatedMissingId')
  assert(supInExport.supplementReason === '10点左右仪器临时校准，完成后立即补测此点', '【核对-导出字段】补录原因')
  assert(supInExport.supplementedBy === '维修师傅老岑', '【核对-导出字段】补录人')
})

console.log('\n' + '═'.repeat(50))
console.log(`测试完成: ${passed} 通过, ${failed} 失败`)

if (failed > 0) {
  process.exit(1)
}
