import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ReconciliationStore } from '../store';
import { RecordStatus, ReviewReason } from '../types';
import { runReconciliation, confirmResult, rejectResult, rollbackResult, findMatches } from '../core/reconciliation';
import { parseGroupSignupFile } from '../importers/group-signup';
import { parseContractFile } from '../importers/contract-screenshot';

describe('核心核对逻辑', () => {
  let testDataFile: string;
  let store: ReconciliationStore;

  beforeEach(() => {
    testDataFile = path.join(__dirname, '..', '..', 'data', `test-${uuidv4()}.json`);
    store = new ReconciliationStore(testDataFile);
  });

  afterEach(() => {
    if (fs.existsSync(testDataFile)) {
      fs.unlinkSync(testDataFile);
    }
  });

  test('临时替补标记后应进入待复核状态，不自动归为正常', () => {
    const batch = store.addBatch({
      source: 'group_signup' as any,
      fileName: 'test.txt',
      recordCount: 1,
      operator: 'test'
    });

    store.addGroupRecords([
      {
        originalRowNumber: 1,
        rawContent: '3. 王五（替补）- 临时替上 - 小星星',
        performerName: '王五',
        songName: '小星星',
        isTemporarySubstitute: true,
        substituteNote: '替补',
        importBatchId: batch.id
      }
    ], batch.id, 'test');

    store.addContractRecords([
      {
        rawContent: '表演者:王五  曲目:小星星',
        performerName: '王五',
        songName: '小星星',
        importBatchId: batch.id
      }
    ], batch.id, 'test');

    const result = runReconciliation(store, 'test');
    expect(result.created).toBe(1);

    const results = store.getState().results;
    expect(results[0].status).toBe(RecordStatus.NEEDS_REVIEW);
    expect(results[0].reviewReasons).toContain(ReviewReason.TEMP_SUBSTITUTE_ONLY_IN_GROUP);
  });

  test('晚到材料增量核对，已确认的记录不被覆盖', () => {
    const batch1 = store.addBatch({
      source: 'group_signup' as any,
      fileName: 'group.txt',
      recordCount: 2,
      operator: 'test'
    });

    store.addGroupRecords([
      {
        originalRowNumber: 1,
        rawContent: '1. 张三 - 月光',
        performerName: '张三',
        songName: '月光',
        importBatchId: batch1.id
      },
      {
        originalRowNumber: 2,
        rawContent: '2. 李四 - 日光',
        performerName: '李四',
        songName: '日光',
        importBatchId: batch1.id
      }
    ], batch1.id, 'test');

    const contractBatch1 = store.addBatch({
      source: 'contract_screenshot' as any,
      fileName: 'contract1.txt',
      recordCount: 1,
      operator: 'test'
    });

    store.addContractRecords([
      {
        rawContent: '表演者:张三 曲目:月光',
        performerName: '张三',
        songName: '月光',
        importBatchId: contractBatch1.id
      }
    ], contractBatch1.id, 'test');

    runReconciliation(store, 'test');
    const results = store.getState().results;
    const zhangsanResult = results.find((r) => r.matchedPerformerName === '张三')!;
    confirmResult(store, zhangsanResult.id, '票务', '确认有效');

    const contractBatch2 = store.addBatch({
      source: 'contract_screenshot' as any,
      fileName: 'contract2-late.txt',
      recordCount: 1,
      operator: 'test'
    });

    store.addContractRecords([
      {
        rawContent: '表演者:李四 曲目:日光',
        performerName: '李四',
        songName: '日光',
        importBatchId: contractBatch2.id
      }
    ], contractBatch2.id, 'test');

    const reconcileResult = runReconciliation(store, 'test', {
      lateContractBatchId: contractBatch2.id,
      preserveConfirmed: true
    });

    expect(reconcileResult.skipped).toBeGreaterThanOrEqual(1);

    const zhangsanAfter = store.getState().results.find((r) => r.matchedPerformerName === '张三')!;
    expect(zhangsanAfter.status).toBe(RecordStatus.CONFIRMED);
  });

  test('接龙原始行号在核对后仍然保留', () => {
    const batch = store.addBatch({
      source: 'group_signup' as any,
      fileName: 'test.txt',
      recordCount: 1,
      operator: 'test'
    });

    store.addGroupRecords([
      {
        originalRowNumber: 42,
        rawContent: '测试内容',
        performerName: '测试',
        songName: '测试曲目',
        importBatchId: batch.id
      }
    ], batch.id, 'test');

    runReconciliation(store, 'test');

    const details = store.getResultsWithDetails();
    expect(details[0].groupRecord?.originalRowNumber).toBe(42);
    expect(details[0].groupRecord?.rawContent).toBe('测试内容');
  });

  test('人工改动记录被保留', () => {
    const batch = store.addBatch({
      source: 'group_signup' as any,
      fileName: 'test.txt',
      recordCount: 1,
      operator: 'test'
    });

    const records = store.addGroupRecords([
      {
        originalRowNumber: 1,
        rawContent: '1. 张叁 - 月光',
        performerName: '张叁',
        songName: '月光',
        importBatchId: batch.id
      }
    ], batch.id, 'test');

    store.updateGroupRecord(records[0].id, { performerName: '张三' }, '票务', 'OCR识别错误，人工修正');

    const updated = store.getState().groupRecords[0];
    expect(updated.manualEdits.length).toBe(1);
    expect(updated.manualEdits[0].fieldName).toBe('performerName');
    expect(updated.manualEdits[0].oldValue).toBe('张叁');
    expect(updated.manualEdits[0].newValue).toBe('张三');
    expect(updated.manualEdits[0].reason).toBe('OCR识别错误，人工修正');
  });

  test('回滚功能正常工作', () => {
    const batch = store.addBatch({
      source: 'group_signup' as any,
      fileName: 'test.txt',
      recordCount: 1,
      operator: 'test'
    });

    store.addGroupRecords([
      {
        originalRowNumber: 1,
        rawContent: '1. 测试 - 测试',
        performerName: '测试',
        songName: '测试',
        importBatchId: batch.id
      }
    ], batch.id, 'test');

    store.addContractRecords([
      {
        rawContent: '表演者:测试',
        performerName: '测试',
        importBatchId: batch.id
      }
    ], batch.id, 'test');

    runReconciliation(store, 'test');
    const result = store.getState().results[0];

    confirmResult(store, result.id, '票务');
    expect(store.getState().results[0].status).toBe(RecordStatus.CONFIRMED);

    rollbackResult(store, result.id, '票务', '误操作');
    expect(store.getState().results[0].status).not.toBe(RecordStatus.CONFIRMED);
    expect(store.getState().results[0].reviewedBy).toBeUndefined();
  });

  test('操作日志完整记录所有变更', () => {
    const batch = store.addBatch({
      source: 'group_signup' as any,
      fileName: 'test.txt',
      recordCount: 1,
      operator: 'userA'
    });

    store.addGroupRecords([
      {
        originalRowNumber: 1,
        rawContent: 'test',
        importBatchId: batch.id
      }
    ], batch.id, 'userA');

    const logs = store.getState().logs;
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.some((l) => l.operator === 'userA')).toBe(true);
    expect(logs.some((l) => l.operationType === 'BULK_IMPORT')).toBe(true);
  });

  test('排练群接龙文件解析 - 识别临时替补', () => {
    const testFile = path.join(__dirname, '..', '..', 'examples', 'group-signup.txt');
    const rows = parseGroupSignupFile(testFile, 'batch-001');

    expect(rows.length).toBe(6);
    expect(rows[0].originalRowNumber).toBe(1);
    expect(rows[0].performerName).toBe('张三');
    expect(rows[0].songName).toBe('月光奏鸣曲');

    const tempRow = rows.find((r) => r.performerName === '王五')!;
    expect(tempRow.isTemporarySubstitute).toBe(true);
    expect(tempRow.substituteNote).toBeDefined();

    const tempRow2 = rows.find((r) => r.performerName === '钱七')!;
    expect(tempRow2.isTemporarySubstitute).toBe(true);
  });

  test('合同文件解析', () => {
    const testFile = path.join(__dirname, '..', '..', 'examples', 'contract-part1.txt');
    const rows = parseContractFile(testFile, 'batch-001');

    expect(rows.length).toBe(3);
    expect(rows[0].performerName).toBe('张三');
    expect(rows[0].songName).toBe('月光奏鸣曲');
    expect(rows[0].contractReference).toBe('HT2024001');
    expect(rows[0].performanceDate).toBe('2024-06-15');
  });
});
