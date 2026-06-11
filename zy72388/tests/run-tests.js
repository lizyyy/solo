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

console.log('\n' + '═'.repeat(50))
console.log(`测试完成: ${passed} 通过, ${failed} 失败`)

if (failed > 0) {
  process.exit(1)
}
