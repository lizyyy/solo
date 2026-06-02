import { dataStore } from '../src/store/dataStore';
import { dailyCutService } from '../src/services/dailyCutService';
import { isPinyinName } from '../src/utils/pinyinDetector';
import { ProcessingStatus, CustodianConfirmationRaw } from '../src/types';

describe('拼音审批人检测', () => {
  test('中文姓名不判定为拼音', () => {
    expect(isPinyinName('张三')).toBe(false);
    expect(isPinyinName('李四光')).toBe(false);
    expect(isPinyinName('王 五')).toBe(false);
  });

  test('拼音姓名判定为拼音', () => {
    expect(isPinyinName('zhang san')).toBe(true);
    expect(isPinyinName('wang er xiao')).toBe(true);
    expect(isPinyinName('Li Si')).toBe(true);
  });

  test('空值或单个单词判定为拼音', () => {
    expect(isPinyinName('')).toBe(true);
    expect(isPinyinName('   ')).toBe(true);
    expect(isPinyinName('zhangsan')).toBe(true);
  });
});

describe('托管确认页导入', () => {
  beforeEach(() => {
    (dataStore as any).confirmations.clear();
    (dataStore as any).historyRecords = [];
  });

  test('正常导入确认页', () => {
    const rawData: CustodianConfirmationRaw[] = [
      {
        originalRowNumber: 1,
        importBatchId: 'BATCH001',
        clientAccount: 'ACC001',
        interestAmount: 1000,
        approverName: '张三',
        approvalDate: '2024-01-15',
        rawContent: '原始行1内容'
      }
    ];

    const result = dataStore.importConfirmations(rawData, '运营小李');
    expect(result.successCount).toBe(1);
    expect(result.duplicateCount).toBe(0);
    expect(result.pinyinApproverCount).toBe(0);

    const conf = dataStore.getConfirmation(result.importedIds[0]);
    expect(conf?.status).toBe(ProcessingStatus.IMPORTED);
    expect(conf?.isPinyinApprover).toBe(false);
    expect(conf?.originalRowNumber).toBe(1);
  });

  test('拼音审批人导入后状态为待复核', () => {
    const rawData: CustodianConfirmationRaw[] = [
      {
        originalRowNumber: 2,
        importBatchId: 'BATCH001',
        clientAccount: 'ACC002',
        interestAmount: 2000,
        approverName: 'li si',
        approvalDate: '2024-01-15',
        rawContent: '原始行2内容'
      }
    ];

    const result = dataStore.importConfirmations(rawData, '运营小李');
    expect(result.pinyinApproverCount).toBe(1);

    const conf = dataStore.getConfirmation(result.importedIds[0]);
    expect(conf?.status).toBe(ProcessingStatus.PENDING_APPROVER_VERIFICATION);
    expect(conf?.isPinyinApprover).toBe(true);
    expect(conf?.currentAssignee).toBe('客户经理');
  });

  test('重复导入不会翻倍数量', () => {
    const rawData: CustodianConfirmationRaw[] = [
      {
        originalRowNumber: 1,
        importBatchId: 'BATCH001',
        clientAccount: 'ACC001',
        interestAmount: 1000,
        approverName: '张三',
        approvalDate: '2024-01-15',
        rawContent: '原始行1内容'
      }
    ];

    const result1 = dataStore.importConfirmations(rawData, '运营小李');
    expect(result1.successCount).toBe(1);
    expect(result1.duplicateCount).toBe(0);

    const result2 = dataStore.importConfirmations(rawData, '运营小李');
    expect(result2.successCount).toBe(0);
    expect(result2.duplicateCount).toBe(1);
    expect(result2.duplicateRowNumbers).toContain(1);

    expect(dataStore.getAllConfirmations().length).toBe(1);
  });
});

describe('备注修改和历史追踪', () => {
  let confirmationId: string;

  beforeEach(() => {
    (dataStore as any).confirmations.clear();
    (dataStore as any).historyRecords = [];
    (dataStore as any).exRightsReviews.clear();
    (dataStore as any).balanceChanges.clear();

    const rawData: CustodianConfirmationRaw[] = [
      {
        originalRowNumber: 1,
        importBatchId: 'BATCH001',
        clientAccount: 'ACC001',
        interestAmount: 1000,
        approverName: '张三',
        approvalDate: '2024-01-15',
        rawContent: '原始行1内容'
      }
    ];

    const result = dataStore.importConfirmations(rawData, '运营小李');
    confirmationId = result.importedIds[0];
  });

  test('修改备注记录改前改后', () => {
    const success = dataStore.updateRemark(
      confirmationId,
      '客户确认金额无误',
      '风控老秦',
      '电话核实后补充备注'
    );

    expect(success).toBe(true);

    const conf = dataStore.getConfirmation(confirmationId);
    expect(conf?.remark).toBe('客户确认金额无误');
    expect(conf?.manualModifications.length).toBe(1);
    expect(conf?.manualModifications[0].fieldName).toBe('remark');
    expect(conf?.manualModifications[0].oldValue).toBe('');
    expect(conf?.manualModifications[0].newValue).toBe('客户确认金额无误');
    expect(conf?.manualModifications[0].modifiedBy).toBe('风控老秦');

    const history = dataStore.getHistory(confirmationId);
    expect(history.length).toBe(2);
    expect(history[1].changeType).toBe('UPDATE');
    expect(history[1].beforeState).not.toBeNull();
    expect(history[1].afterState).not.toBeNull();
  });
});

describe('审批人复核流程', () => {
  let confirmationId: string;

  beforeEach(() => {
    (dataStore as any).confirmations.clear();
    (dataStore as any).historyRecords = [];
    (dataStore as any).exRightsReviews.clear();
    (dataStore as any).balanceChanges.clear();

    const rawData: CustodianConfirmationRaw[] = [
      {
        originalRowNumber: 1,
        importBatchId: 'BATCH001',
        clientAccount: 'ACC001',
        interestAmount: 1000,
        approverName: 'wang wu',
        approvalDate: '2024-01-15',
        rawContent: '原始行内容'
      }
    ];

    const result = dataStore.importConfirmations(rawData, '运营小李');
    confirmationId = result.importedIds[0];
  });

  test('拼音审批人待复核状态', () => {
    const conf = dataStore.getConfirmation(confirmationId);
    expect(conf?.status).toBe(ProcessingStatus.PENDING_APPROVER_VERIFICATION);
    expect(conf?.isPinyinApprover).toBe(true);
  });

  test('客户经理复核后状态变更', () => {
    const success = dataStore.verifyApproverName(
      confirmationId,
      '王五',
      '客户经理小赵'
    );

    expect(success).toBe(true);

    const conf = dataStore.getConfirmation(confirmationId);
    expect(conf?.status).toBe(ProcessingStatus.APPROVER_VERIFIED);
    expect(conf?.isPinyinApprover).toBe(false);
    expect(conf?.approverName).toBe('王五');
    expect(conf?.currentAssignee).toBeNull();

    const modifications = conf?.manualModifications || [];
    expect(modifications.some(m => m.fieldName === 'approverName')).toBe(true);
  });
});

describe('标准三步流程', () => {
  let confirmationId: string;

  beforeEach(() => {
    (dataStore as any).confirmations.clear();
    (dataStore as any).historyRecords = [];
    (dataStore as any).exRightsReviews.clear();
    (dataStore as any).balanceChanges.clear();

    const rawData: CustodianConfirmationRaw[] = [
      {
        originalRowNumber: 1,
        importBatchId: 'BATCH001',
        clientAccount: 'ACC001',
        interestAmount: 1000,
        approverName: '张三',
        approvalDate: '2024-01-15',
        rawContent: '原始行1内容'
      }
    ];

    const result = dataStore.importConfirmations(rawData, '运营小李');
    confirmationId = result.importedIds[0];
  });

  test('完整流程：导入→除权审查→余额更新', () => {
    expect(dataStore.getConfirmation(confirmationId)?.status).toBe(ProcessingStatus.IMPORTED);

    const exRightsReview = dailyCutService.reviewExRightsDate(
      confirmationId,
      '风控老秦',
      'screenshot_20240115_001.png',
      true,
      '2024-01-10',
      '股票分红除权，利息调整-50',
      -50
    );

    expect(exRightsReview).not.toBeNull();
    expect(exRightsReview?.hasExRightsEvent).toBe(true);
    expect(exRightsReview?.adjustmentAmount).toBe(-50);
    expect(dataStore.getConfirmation(confirmationId)?.status).toBe(ProcessingStatus.EX_RIGHTS_DATE_REVIEWED);

    const balanceChange = dailyCutService.updateBalance(
      confirmationId,
      '结算小王',
      50000,
      '2024-01-16'
    );

    expect(balanceChange).not.toBeNull();
    expect(balanceChange?.previousBalance).toBe(50000);
    expect(balanceChange?.interestAmount).toBe(1000);
    expect(balanceChange?.adjustmentAmount).toBe(-50);
    expect(balanceChange?.newBalance).toBe(50950);
    expect(dataStore.getConfirmation(confirmationId)?.status).toBe(ProcessingStatus.BALANCE_UPDATED);
  });

  test('拼音审批人无法直接走完流程', () => {
    (dataStore as any).confirmations.clear();
    (dataStore as any).historyRecords = [];

    const rawData: CustodianConfirmationRaw[] = [
      {
        originalRowNumber: 2,
        importBatchId: 'BATCH001',
        clientAccount: 'ACC002',
        interestAmount: 2000,
        approverName: 'zhao liu',
        approvalDate: '2024-01-15',
        rawContent: '原始行2内容'
      }
    ];

    const result = dataStore.importConfirmations(rawData, '运营小李');
    const pinyinConfirmationId = result.importedIds[0];

    const workflowResult = dailyCutService.processFullWorkflow(
      pinyinConfirmationId,
      '风控老秦',
      'screenshot_002.png',
      false,
      null,
      '无除权事件',
      30000,
      '2024-01-16'
    );

    expect(workflowResult.completed).toBe(false);
    expect(workflowResult.exRightsReview).toBeNull();
    expect(workflowResult.balanceChange).toBeNull();

    const conf = dataStore.getConfirmation(pinyinConfirmationId);
    expect(conf?.status).toBe(ProcessingStatus.PENDING_APPROVER_VERIFICATION);
  });
});

describe('回滚机制', () => {
  let confirmationId: string;

  beforeEach(() => {
    (dataStore as any).confirmations.clear();
    (dataStore as any).historyRecords = [];
    (dataStore as any).exRightsReviews.clear();
    (dataStore as any).balanceChanges.clear();

    const rawData: CustodianConfirmationRaw[] = [
      {
        originalRowNumber: 1,
        importBatchId: 'BATCH001',
        clientAccount: 'ACC001',
        interestAmount: 1000,
        approverName: '张三',
        approvalDate: '2024-01-15',
        rawContent: '原始行1内容'
      }
    ];

    const result = dataStore.importConfirmations(rawData, '运营小李');
    confirmationId = result.importedIds[0];

    dailyCutService.reviewExRightsDate(
      confirmationId,
      '风控老秦',
      'screenshot_001.png',
      false,
      null,
      '无除权事件'
    );

    dailyCutService.updateBalance(
      confirmationId,
      '结算小王',
      50000,
      '2024-01-16'
    );
  });

  test('回滚到导入状态', () => {
    const confBefore = dataStore.getConfirmation(confirmationId);
    expect(confBefore?.status).toBe(ProcessingStatus.BALANCE_UPDATED);
    expect(confBefore?.exRightsDateReviewId).not.toBeNull();
    expect(confBefore?.balanceUpdateId).not.toBeNull();

    const result = dataStore.rollbackToStatus(
      confirmationId,
      ProcessingStatus.IMPORTED,
      '风控老秦',
      '金额口径错误，需重新处理'
    );

    expect(result.success).toBe(true);
    expect(result.rollbackedStatus).toBe(ProcessingStatus.IMPORTED);

    const confAfter = dataStore.getConfirmation(confirmationId);
    expect(confAfter?.status).toBe(ProcessingStatus.IMPORTED);
    expect(confAfter?.exRightsDateReviewId).toBeNull();
    expect(confAfter?.balanceUpdateId).toBeNull();

    const history = dataStore.getHistory(confirmationId);
    expect(history.some(h => h.changeType === 'ROLLBACK')).toBe(true);
  });
});

describe('证据链查询', () => {
  let confirmationId: string;

  beforeEach(() => {
    (dataStore as any).confirmations.clear();
    (dataStore as any).historyRecords = [];
    (dataStore as any).exRightsReviews.clear();
    (dataStore as any).balanceChanges.clear();

    const rawData: CustodianConfirmationRaw[] = [
      {
        originalRowNumber: 5,
        importBatchId: 'BATCH001',
        clientAccount: 'ACC005',
        interestAmount: 1500,
        approverName: '张三',
        approvalDate: '2024-01-15',
        rawContent: '第5行原始托管数据'
      }
    ];

    const result = dataStore.importConfirmations(rawData, '运营小李');
    confirmationId = result.importedIds[0];

    dataStore.updateRemark(
      confirmationId,
      '客户电话确认',
      '风控老秦',
      '补充备注'
    );
  });

  test('客户经理可查询完整证据链', () => {
    dailyCutService.reviewExRightsDate(
      confirmationId,
      '风控老秦',
      'screenshot_005.png',
      false,
      null,
      '无除权'
    );

    dailyCutService.updateBalance(
      confirmationId,
      '结算小王',
      100000,
      '2024-01-16'
    );

    const evidence = dailyCutService.getEvidenceForCustomerManager(confirmationId);

    expect(evidence).not.toBeNull();
    expect(evidence?.originalRowNumber).toBe(5);
    expect(evidence?.rawContent).toBe('第5行原始托管数据');
    expect(evidence?.manualModifications.length).toBeGreaterThan(0);
    expect(evidence?.status).toBe(ProcessingStatus.BALANCE_UPDATED);
    expect(evidence?.statusFlow.length).toBeGreaterThan(0);
    expect(evidence?.history.length).toBeGreaterThan(0);
    expect(evidence?.exRightsReview).not.toBeNull();
    expect(evidence?.balanceChange).not.toBeNull();
  });
});

describe('状态流转追踪', () => {
  let confirmationId: string;

  beforeEach(() => {
    (dataStore as any).confirmations.clear();
    (dataStore as any).historyRecords = [];
    (dataStore as any).exRightsReviews.clear();
    (dataStore as any).balanceChanges.clear();

    const rawData: CustodianConfirmationRaw[] = [
      {
        originalRowNumber: 1,
        importBatchId: 'BATCH001',
        clientAccount: 'ACC001',
        interestAmount: 1000,
        approverName: '张三',
        approvalDate: '2024-01-15',
        rawContent: '原始内容'
      }
    ];

    const result = dataStore.importConfirmations(rawData, '运营小李');
    confirmationId = result.importedIds[0];
  });

  test('状态流可追踪每个环节的操作人', () => {
    dailyCutService.reviewExRightsDate(
      confirmationId,
      '风控老秦',
      'screenshot_001.png',
      false,
      null,
      '无除权'
    );

    dailyCutService.updateBalance(
      confirmationId,
      '结算小王',
      50000,
      '2024-01-16'
    );

    const statusFlow = dataStore.getStatusFlow(confirmationId);

    expect(statusFlow.length).toBe(3);
    expect(statusFlow[0].status).toBe(ProcessingStatus.IMPORTED);
    expect(statusFlow[0].operator).toBe('运营小李');
    expect(statusFlow[1].status).toBe(ProcessingStatus.EX_RIGHTS_DATE_REVIEWED);
    expect(statusFlow[1].operator).toBe('风控老秦');
    expect(statusFlow[2].status).toBe(ProcessingStatus.BALANCE_UPDATED);
    expect(statusFlow[2].operator).toBe('结算小王');
  });
});
