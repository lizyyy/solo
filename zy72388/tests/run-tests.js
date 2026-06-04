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
  ])
  assert(result.success.length === 1, '应该成功导入 1 条记录')
  assert(service.getRecords().length === 1, '服务中应该有 1 条记录')
})

test('应该能检测重复导入', () => {
  const service = new ReverberationService()
  service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 }
  ])
  const result = service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.5 }
  ])
  assert(result.duplicates.length === 1, '应该检测到 1 条重复记录')
})

test('应该能检测采样时间缺失', () => {
  const service = new ReverberationService()
  service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:45:00', location: '会议室A', frequency: 500, reverberationTime: 1.3 }
  ])
  const missing = service.getMissingTimeRecords()
  assert(missing.length === 1, '应该检测到 1 个时间缺失')
  assert(Math.round(missing[0].gapDuration) === 45, '缺失间隔应该约为 45 分钟')
})

test('应该能添加补录记录并重算', () => {
  const service = new ReverberationService()
  const importResult = service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 }
  ])
  const originalId = importResult.success[0].id
  
  const result = service.addSupplementRecord(
    originalId,
    { sampleTime: '2026-06-04T10:30:00', location: '会议室A', frequency: 500, reverberationTime: 1.1 },
    '补录缺失数据',
    '老岑'
  )
  
  assert(result.success === true, '补录应该成功')
  assert(result.record.isSupplement === true, '应该标记为补录记录')
  assert(result.record.originalRecordId === originalId, '应该关联原始记录')
  assert(service.getRecords().length === 2, '应该有 2 条记录')
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

test('应该能正确运行系统自检', () => {
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
  assert(results.exportConsistencyCheck.consistent === true, '导出应该一致')
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
  assert(chartData.datasets.length === 3, '应该有 3 个数据系列')
})

test('应该能审核缺失记录并记录理由', () => {
  const service = new ReverberationService()
  service.importRecords([
    { sampleTime: '2026-06-04T10:00:00', location: '会议室A', frequency: 500, reverberationTime: 1.2 },
    { sampleTime: '2026-06-04T10:45:00', location: '会议室A', frequency: 500, reverberationTime: 1.3 }
  ])
  
  const missing = service.getMissingTimeRecords()[0]
  const result = service.reviewMissingRecord(
    missing.id,
    'keep',
    '当时设备临时维护，数据不可用',
    '老岑'
  )
  
  assert(result.success === true, '审核应该成功')
  assert(result.record.status === 'kept', '状态应该设置为 kept')
  assert(result.record.keepReason === '当时设备临时维护，数据不可用', '理由应该被记录')
  assert(result.record.reviewedBy === '老岑', '审核人应该被记录')
})

test('应该能解决冲突（不自动拍板）', () => {
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

console.log('\n📊 工作流程测试')
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
  ])
  
  assert(importResult.success.length === 4, '第一步：应该能导入所有记录')
  assert(service.getMissingTimeRecords().length === 1, '第一步：应该检测到时间缺失')
  
  const noteResult = service.addInspectionNote({
    recordId: importResult.success[2].id,
    noteContent: '现场检查正常',
    author: '质检员小王',
    isHandwritten: true
  })
  
  assert(noteResult.conflicts.length === 1, '第二步：应该检测到备注与阈值冲突')
  
  const missing = service.getMissingTimeRecords()[0]
  service.reviewMissingRecord(missing.id, 'keep', '当时有临时会议，无法测量', '老岑')
  
  service.resolveConflict(noteResult.conflicts[0].id, 'confirm', '老岑')
  
  const chartData = service.getReviewChartData()
  assert(chartData.labels.length > 0, '第三步：应该能生成复盘图数据')
  
  const selfCheck = service.runSelfCheck()
  assert(selfCheck.missingTimeCheck.hasIssues === true, '第三步：自检应该仍显示有缺失（已保留）')
})

console.log('\n' + '═'.repeat(50))
console.log(`测试完成: ${passed} 通过, ${failed} 失败`)

if (failed > 0) {
  process.exit(1)
}
