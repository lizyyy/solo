import { store } from '../src/store';
import { RetestStatus } from '../src/types';

describe('实验室LIMS样本重测申请 - 核心业务逻辑测试', () => {
  beforeEach(() => {
    const requests = store.listRequests();
    for (const req of requests) {
      (store as any).retestRequests.delete(req.requestId);
    }
    (store as any).historyRecords = [];
  });

  const createTestRequest = (sampleId: string = 'S001') => {
    return store.createRequest({
      sample: {
        sampleId,
        sampleName: '血清样本',
        sampleType: '血液',
        collectionTime: '2024-01-15T08:00:00Z'
      },
      testItems: [
        {
          itemCode: 'GLU',
          itemName: '葡萄糖',
          originalResult: '5.6',
          originalResultTime: '2024-01-15T10:00:00Z'
        },
        {
          itemCode: 'CHO',
          itemName: '胆固醇',
          originalResult: '4.2',
          originalResultTime: '2024-01-15T10:00:00Z'
        }
      ],
      retestReason: '结果异常，需要复核',
      applicant: '张检验师'
    });
  };

  test('测试1: 重测失败后原结果被提前覆盖 - 验证原结果保护机制', () => {
    const request = createTestRequest();
    const originalResult = request.testItems[0].originalResult;
    
    store.auditRequest(request.requestId, {
      auditor: '李主管',
      auditOpinion: '同意重测',
      approved: true
    });

    expect(store.getRequest(request.requestId)?.status).toBe(RetestStatus.RETESTING);

    store.submitRetestResult(request.requestId, {
      itemCode: 'GLU',
      retestResult: 'FAIL',
      operator: '王技术员',
      success: false
    });

    const failedRequest = store.getRequest(request.requestId);
    expect(failedRequest?.status).toBe(RetestStatus.RETEST_FAILED);
    expect(failedRequest?.testItems[0].originalResult).toBe(originalResult);
    expect(failedRequest?.testItems[0].retestResult).toBeUndefined();

    const history = store.getHistory(request.requestId);
    const failedRecord = history.find(h => h.operation === '重测失败');
    expect(failedRecord).toBeDefined();
    expect(failedRecord?.remark).toContain('原结果保留');
  });

  test('测试2: 重复请求 - 同一样本不能同时有多个进行中的重测申请', () => {
    createTestRequest('S002');

    expect(() => {
      createTestRequest('S002');
    }).toThrow('已有进行中的重测申请');

    const requests = store.listRequests({ sampleId: 'S002' });
    expect(requests.length).toBe(1);
  });

  test('测试3: 撤回后再提交 - 状态流转验证', () => {
    const request = createTestRequest('S003');
    expect(request.status).toBe(RetestStatus.RETEST_APPLIED);

    store.withdrawRequest(request.requestId, '张检验师');
    const withdrawnRequest = store.getRequest(request.requestId);
    expect(withdrawnRequest?.status).toBe(RetestStatus.WITHDRAWN);
    expect(withdrawnRequest?.version).toBe(2);

    const resubmittedRequest = store.resubmitRequest(request.requestId, '张检验师');
    expect(resubmittedRequest.status).toBe(RetestStatus.RETEST_APPLIED);
    expect(resubmittedRequest.version).toBe(3);
    expect(resubmittedRequest.testItems[0].retestResult).toBeUndefined();
    expect(resubmittedRequest.auditor).toBeUndefined();
    expect(resubmittedRequest.auditOpinion).toBeUndefined();

    const history = store.getHistory(request.requestId);
    expect(history.some(h => h.operation === '撤回申请')).toBe(true);
    expect(history.some(h => h.operation === '重新提交')).toBe(true);
  });

  test('测试4: 完整状态流转 - 创建→审核→重测→完成', () => {
    const request = createTestRequest('S004');
    expect(request.status).toBe(RetestStatus.RETEST_APPLIED);
    expect(request.version).toBe(1);

    store.auditRequest(request.requestId, {
      auditor: '李主管',
      auditOpinion: '同意',
      approved: true
    });
    expect(store.getRequest(request.requestId)?.status).toBe(RetestStatus.RETESTING);

    store.submitRetestResult(request.requestId, {
      itemCode: 'GLU',
      retestResult: '5.5',
      operator: '王技术员',
      success: true
    });

    store.submitRetestResult(request.requestId, {
      itemCode: 'CHO',
      retestResult: '4.1',
      operator: '王技术员',
      success: true
    });

    const finalRequest = store.getRequest(request.requestId);
    expect(finalRequest?.status).toBe(RetestStatus.REPLACED);
    expect(finalRequest?.testItems[0].retestResult).toBe('5.5');
    expect(finalRequest?.testItems[1].retestResult).toBe('4.1');
  });

  test('测试5: 修改申请 - 仅申请状态可修改', () => {
    const request = createTestRequest('S005');

    const updatedRequest = store.updateRequest(
      request.requestId,
      { retestReason: '修改后的重测原因' },
      '张检验师'
    );
    expect(updatedRequest.retestReason).toBe('修改后的重测原因');
    expect(updatedRequest.version).toBe(2);

    store.auditRequest(request.requestId, {
      auditor: '李主管',
      auditOpinion: '同意',
      approved: true
    });

    expect(() => {
      store.updateRequest(
        request.requestId,
        { retestReason: '再次修改' },
        '张检验师'
      );
    }).toThrow('仅"重测申请"状态的记录可以修改');
  });

  test('测试6: 导出CSV功能 - 数据完整性验证', () => {
    createTestRequest('S006');
    createTestRequest('S007');

    const csv = store.exportToCSV();
    expect(csv).toContain('申请编号');
    expect(csv).toContain('S006');
    expect(csv).toContain('S007');
    expect(csv).toContain('葡萄糖');
    expect(csv).toContain('胆固醇');
  });

  test('测试7: 操作历史记录 - 完整追溯', () => {
    const request = createTestRequest('S008');
    
    store.auditRequest(request.requestId, {
      auditor: '李主管',
      auditOpinion: '同意重测',
      approved: true
    });

    store.withdrawRequest(request.requestId, '张检验师');

    const history = store.getHistory(request.requestId);
    expect(history.length).toBe(3);
    const operations = history.map(h => h.operation);
    expect(operations).toContain('创建申请');
    expect(operations).toContain('审核通过');
    expect(operations).toContain('撤回申请');
  });
});
