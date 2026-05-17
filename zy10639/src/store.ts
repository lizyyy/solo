import { RetestRequest, HistoryRecord, RetestStatus, CreateRetestRequest, UpdateRetestRequest, AuditRequest, RetestResultRequest } from './types';

class DataStore {
  private retestRequests: Map<string, RetestRequest> = new Map();
  private historyRecords: HistoryRecord[] = [];
  private requestCounter = 0;
  private historyCounter = 0;

  private generateRequestId(): string {
    this.requestCounter++;
    return `RT${Date.now()}${String(this.requestCounter).padStart(4, '0')}`;
  }

  private generateHistoryId(): string {
    this.historyCounter++;
    return `H${Date.now()}${String(this.historyCounter).padStart(4, '0')}`;
  }

  private addHistory(
    requestId: string,
    operation: string,
    operator: string,
    snapshot: Partial<RetestRequest>,
    oldStatus?: RetestStatus,
    newStatus?: RetestStatus,
    remark?: string
  ): void {
    const record: HistoryRecord = {
      historyId: this.generateHistoryId(),
      requestId,
      operation,
      operator,
      operateTime: new Date().toISOString(),
      oldStatus,
      newStatus,
      remark,
      snapshot
    };
    this.historyRecords.push(record);
  }

  createRequest(data: CreateRetestRequest): RetestRequest {
    const existingRequest = Array.from(this.retestRequests.values()).find(
      r => r.sample.sampleId === data.sample.sampleId && 
           r.status !== RetestStatus.REPLACED && 
           r.status !== RetestStatus.WITHDRAWN &&
           !r.isDeleted
    );
    
    if (existingRequest) {
      throw new Error(`样本 ${data.sample.sampleId} 已有进行中的重测申请`);
    }

    const requestId = this.generateRequestId();
    const now = new Date().toISOString();
    
    const request: RetestRequest = {
      requestId,
      sample: data.sample,
      testItems: data.testItems.map(item => ({
        ...item,
        retestResult: undefined,
        retestResultTime: undefined
      })),
      retestReason: data.retestReason,
      applicant: data.applicant,
      applyTime: now,
      status: RetestStatus.RETEST_APPLIED,
      version: 1,
      isDeleted: false
    };

    this.retestRequests.set(requestId, request);
    this.addHistory(requestId, '创建申请', data.applicant, { ...request });

    return request;
  }

  getRequest(requestId: string): RetestRequest | undefined {
    return this.retestRequests.get(requestId);
  }

  listRequests(filters?: { status?: RetestStatus; sampleId?: string }): RetestRequest[] {
    let requests = Array.from(this.retestRequests.values()).filter(r => !r.isDeleted);
    
    if (filters?.status) {
      requests = requests.filter(r => r.status === filters.status);
    }
    
    if (filters?.sampleId) {
      requests = requests.filter(r => r.sample.sampleId === filters.sampleId);
    }
    
    return requests.sort((a, b) => new Date(b.applyTime).getTime() - new Date(a.applyTime).getTime());
  }

  updateRequest(requestId: string, data: UpdateRetestRequest, operator: string): RetestRequest {
    const request = this.retestRequests.get(requestId);
    if (!request || request.isDeleted) {
      throw new Error('重测申请不存在');
    }

    if (request.status !== RetestStatus.RETEST_APPLIED) {
      throw new Error('仅"重测申请"状态的记录可以修改');
    }

    const oldSnapshot = { ...request };

    if (data.testItems) {
      request.testItems = data.testItems.map(item => ({
        ...item,
        retestResult: undefined,
        retestResultTime: undefined
      }));
    }
    if (data.retestReason) {
      request.retestReason = data.retestReason;
    }
    request.version++;

    this.addHistory(requestId, '修改申请', operator, oldSnapshot, request.status, request.status, '修改申请信息');
    return request;
  }

  auditRequest(requestId: string, data: AuditRequest): RetestRequest {
    const request = this.retestRequests.get(requestId);
    if (!request || request.isDeleted) {
      throw new Error('重测申请不存在');
    }

    if (request.status !== RetestStatus.RETEST_APPLIED) {
      throw new Error('仅"重测申请"状态的记录可以审核');
    }

    const oldStatus = request.status;
    const oldSnapshot = { ...request };

    request.auditor = data.auditor;
    request.auditTime = new Date().toISOString();
    request.auditOpinion = data.auditOpinion;

    if (data.approved) {
      request.status = RetestStatus.RETESTING;
    } else {
      request.status = RetestStatus.WITHDRAWN;
    }
    request.version++;

    this.addHistory(
      requestId,
      data.approved ? '审核通过' : '审核拒绝',
      data.auditor,
      oldSnapshot,
      oldStatus,
      request.status,
      data.auditOpinion
    );

    return request;
  }

  withdrawRequest(requestId: string, operator: string): RetestRequest {
    const request = this.retestRequests.get(requestId);
    if (!request || request.isDeleted) {
      throw new Error('重测申请不存在');
    }

    if (request.status === RetestStatus.REPLACED || request.status === RetestStatus.WITHDRAWN) {
      throw new Error('当前状态不允许撤回');
    }

    const oldStatus = request.status;
    const oldSnapshot = { ...request };

    request.status = RetestStatus.WITHDRAWN;
    request.version++;

    this.addHistory(requestId, '撤回申请', operator, oldSnapshot, oldStatus, RetestStatus.WITHDRAWN);
    return request;
  }

  submitRetestResult(requestId: string, data: RetestResultRequest): RetestRequest {
    const request = this.retestRequests.get(requestId);
    if (!request || request.isDeleted) {
      throw new Error('重测申请不存在');
    }

    if (request.status !== RetestStatus.RETESTING) {
      throw new Error('仅"重测中"状态的记录可以提交重测结果');
    }

    const testItem = request.testItems.find(item => item.itemCode === data.itemCode);
    if (!testItem) {
      throw new Error('检测项目不存在');
    }

    const oldSnapshot = { ...request };
    const oldStatus = request.status;

    if (data.success) {
      testItem.retestResult = data.retestResult;
      testItem.retestResultTime = new Date().toISOString();

      const allCompleted = request.testItems.every(item => item.retestResult !== undefined);
      if (allCompleted) {
        request.status = RetestStatus.REPLACED;
      }

      request.version++;
      this.addHistory(
        requestId,
        '提交重测结果',
        data.operator,
        oldSnapshot,
        oldStatus,
        request.status,
        `项目 ${data.itemCode} 重测成功`
      );
    } else {
      request.status = RetestStatus.RETEST_FAILED;
      request.version++;
      this.addHistory(
        requestId,
        '重测失败',
        data.operator,
        oldSnapshot,
        oldStatus,
        RetestStatus.RETEST_FAILED,
        `项目 ${data.itemCode} 重测失败，原结果保留`
      );
    }

    return request;
  }

  resubmitRequest(requestId: string, operator: string): RetestRequest {
    const request = this.retestRequests.get(requestId);
    if (!request || request.isDeleted) {
      throw new Error('重测申请不存在');
    }

    if (request.status !== RetestStatus.WITHDRAWN && request.status !== RetestStatus.RETEST_FAILED) {
      throw new Error('仅"已撤回"或"重测失败"状态的记录可以重新提交');
    }

    const oldStatus = request.status;
    const oldSnapshot = { ...request };

    request.testItems = request.testItems.map(item => ({
      ...item,
      retestResult: undefined,
      retestResultTime: undefined
    }));
    request.status = RetestStatus.RETEST_APPLIED;
    request.auditor = undefined;
    request.auditTime = undefined;
    request.auditOpinion = undefined;
    request.version++;

    this.addHistory(requestId, '重新提交', operator, oldSnapshot, oldStatus, RetestStatus.RETEST_APPLIED);
    return request;
  }

  getHistory(requestId: string): HistoryRecord[] {
    return this.historyRecords
      .filter(r => r.requestId === requestId)
      .sort((a, b) => new Date(b.operateTime).getTime() - new Date(a.operateTime).getTime());
  }

  exportToCSV(): string {
    const requests = this.listRequests();
    const rows: string[][] = [];
    
    rows.push([
      '申请编号',
      '样本ID',
      '样本名称',
      '样本类型',
      '采样时间',
      '检测项目',
      '原结果',
      '重测结果',
      '重测原因',
      '申请人',
      '申请时间',
      '审核人',
      '审核时间',
      '审核意见',
      '状态',
      '版本'
    ]);

    for (const request of requests) {
      for (const item of request.testItems) {
        rows.push([
          request.requestId,
          request.sample.sampleId,
          request.sample.sampleName,
          request.sample.sampleType,
          request.sample.collectionTime,
          `${item.itemCode}-${item.itemName}`,
          item.originalResult,
          item.retestResult || '',
          request.retestReason,
          request.applicant,
          request.applyTime,
          request.auditor || '',
          request.auditTime || '',
          request.auditOpinion || '',
          request.status,
          String(request.version)
        ]);
      }
    }

    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  importBadRow(data: any, operator: string): RetestRequest {
    const requestId = this.generateRequestId();
    const now = new Date().toISOString();
    
    const request: RetestRequest = {
      requestId,
      sample: {
        sampleId: data.sampleId || 'INVALID',
        sampleName: data.sampleName || '无效样本',
        sampleType: data.sampleType || '未知',
        collectionTime: data.collectionTime || now
      },
      testItems: (data.testItems || []).map((item: any) => ({
        itemCode: item.itemCode || 'ERR',
        itemName: item.itemName || '错误项目',
        originalResult: item.originalResult || 'N/A',
        originalResultTime: item.originalResultTime || now
      })),
      retestReason: `导入坏行 - ${data.remark || '数据异常'}`,
      applicant: operator,
      applyTime: now,
      status: RetestStatus.RETEST_APPLIED,
      version: 1,
      isDeleted: false
    };

    this.retestRequests.set(requestId, request);
    this.addHistory(requestId, '导入坏行', operator, { ...request }, undefined, undefined, '补录痕迹标记');

    return request;
  }
}

export const store = new DataStore();
