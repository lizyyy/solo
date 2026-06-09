import { db } from '../db'
import { create as createTeacherNote } from '../repositories/teacherNoteRepository'
import { create as createSamplingList } from '../repositories/samplingListRepository'
import { create as createBillRecord, count as countBillRecords, getRecordCounts } from '../repositories/billRecordRepository'
import { create as createGapRecord } from '../repositories/gapRecordRepository'
import { create as createParamVersion } from '../repositories/paramVersionRepository'
import { create as createOperationHistory } from '../repositories/operationHistoryRepository'
import { generateBatchId } from '../utils/idGenerator'

function seedMockData(): void {
  if (countBillRecords() > 0) {
    return
  }

  const operator = 'admin'
  const operatorRole = 'admin'
  const batchId = generateBatchId()

  const insertSeedData = (): void => {
    const teacherNote003 = createTeacherNote({
      recordNo: '003',
      date: '2025-03-15',
      teacherName: '张三',
      amount: 300,
      itemType: '课时费',
      annotation: '正常授课',
      importBatchId: batchId,
      importedBy: operator,
    })

    const teacherNote005 = createTeacherNote({
      recordNo: '005',
      date: '2025-03-18',
      teacherName: '李四',
      amount: 400,
      itemType: '课时费',
      annotation: '正常授课',
      importBatchId: batchId,
      importedBy: operator,
    })

    const teacherNote007 = createTeacherNote({
      recordNo: '007',
      date: '2025-03-20',
      teacherName: '李四',
      amount: 500,
      itemType: '课时费',
      annotation: '正常授课',
      importBatchId: batchId,
      importedBy: operator,
    })

    const teacherNote008 = createTeacherNote({
      recordNo: '008',
      date: '2025-03-21',
      teacherName: '李四',
      amount: 450,
      itemType: '课时费',
      annotation: '正常授课',
      importBatchId: batchId,
      importedBy: operator,
    })

    const samplingList003 = createSamplingList({
      recordNo: '003',
      date: '2025-03-15',
      teacherName: '张三',
      amount: 300,
      itemType: '课时费',
      sceneDescription: '现场授课确认',
      isOldFormat: false,
      importBatchId: batchId,
      importedBy: operator,
    })

    const samplingList007 = createSamplingList({
      recordNo: '007',
      date: '2025-03-20',
      teacherName: '李四',
      amount: 500,
      itemType: '课时费',
      sceneDescription: '现场确认',
      isOldFormat: false,
      importBatchId: batchId,
      importedBy: operator,
    })

    const samplingList012 = createSamplingList({
      recordNo: '012',
      date: '2025-02-28',
      teacherName: '王五',
      amount: 200,
      itemType: '辅导费',
      sceneDescription: '旧口径补录',
      isOldFormat: true,
      importBatchId: batchId,
      importedBy: operator,
    })

    const record003 = createBillRecord({
      recordNo: '003',
      date: '2025-03-15',
      teacherName: '张三',
      amount: 300,
      itemType: '课时费',
      status: 'smooth',
      teacherNoteId: teacherNote003.id,
      samplingListId: samplingList003.id,
    })

    const record007 = createBillRecord({
      recordNo: '007',
      date: '2025-03-20',
      teacherName: '李四',
      amount: 500,
      itemType: '课时费',
      status: 'gap',
      teacherNoteId: teacherNote007.id,
      samplingListId: samplingList007.id,
    })

    const record012 = createBillRecord({
      recordNo: '012',
      date: '2025-02-28',
      teacherName: '王五',
      amount: 200,
      itemType: '辅导费',
      status: 'supplement',
      teacherNoteId: undefined,
      samplingListId: samplingList012.id,
    })

    createGapRecord({
      recordId: record007.id,
      missingRecordNo: '006',
      previousRecordNo: '005',
      nextRecordNo: '007',
    })

    const initialVersion = createParamVersion({
      version: 'v1.0',
      snapshot: JSON.stringify({
        teacherNotes: [teacherNote003, teacherNote005, teacherNote007, teacherNote008],
        samplingLists: [samplingList003, samplingList007, samplingList012],
        billRecords: [record003, record007, record012],
      }),
      changeSummary: '初始化样例数据，包含顺利记录、断档记录、补录记录各一条',
      operator,
      recordCount: getRecordCounts(),
    })

    createOperationHistory({
      operationType: 'import',
      description: '导入老师批注数据 4 条，抽样名单数据 3 条',
      operator,
      operatorRole,
    })

    createOperationHistory({
      operationType: 'match',
      description: '匹配记录 003 状态为顺利',
      recordId: record003.id,
      operator,
      operatorRole,
      beforeState: {
        status: 'pending',
        recordNo: record003.recordNo,
        teacherName: record003.teacherName,
        amount: record003.amount,
      },
      afterState: {
        status: 'smooth',
        recordNo: record003.recordNo,
        teacherName: record003.teacherName,
        amount: record003.amount,
        nextHandler: '无',
        reason: '双边数据完全一致，顺利通过',
      },
      nextHandler: '无',
      reason: '双边数据完全一致，顺利通过',
    })

    createOperationHistory({
      operationType: 'match',
      description: '匹配记录 007 状态为断档，缺失记录 006',
      recordId: record007.id,
      operator,
      operatorRole,
      beforeState: {
        status: 'pending',
        recordNo: record007.recordNo,
        teacherName: record007.teacherName,
        amount: record007.amount,
      },
      afterState: {
        status: 'gap',
        recordNo: record007.recordNo,
        missingRecordNo: '006',
        previousNo: '005',
        nextNo: '007',
        nextHandler: '教研组',
        reason: '编号断档：005 之后跳过 006 直接到 007，疑似人工删除一行',
      },
      nextHandler: '教研组',
      reason: '编号断档：005 之后跳过 006 直接到 007，疑似人工删除一行',
    })

    createOperationHistory({
      operationType: 'match',
      description: '匹配记录 012 状态为补录（旧口径）',
      recordId: record012.id,
      operator,
      operatorRole,
      beforeState: {
        status: 'pending',
        recordNo: record012.recordNo,
        teacherName: record012.teacherName,
        amount: record012.amount,
      },
      afterState: {
        status: 'supplement',
        recordNo: record012.recordNo,
        teacherName: record012.teacherName,
        amount: record012.amount,
        nextHandler: '唐老师',
        reason: '旧口径补录，仅抽样名单中有，老师批注中无此记录',
      },
      nextHandler: '唐老师',
      reason: '旧口径补录，仅抽样名单中有，老师批注中无此记录',
    })

    createOperationHistory({
      operationType: 'version_create',
      description: `创建参数版本 ${initialVersion.version}`,
      operator,
      operatorRole,
    })
  }

  const insertTransaction = db.transaction(insertSeedData)
  insertTransaction()
}

export { seedMockData }
