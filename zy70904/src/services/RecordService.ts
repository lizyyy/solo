import dataStore from '../models/DataStore';
import {
  ProcessingRecord,
  Receipt,
  Member,
  ActivityRule,
  RecordStatus,
  OperationType,
  BoundaryType,
  BoundaryInfo,
  AuditTrail
} from '../types';

class RecordService {
  createProcessingRecord(
    batchId: string,
    receipt: Receipt,
    member: Member,
    activityRule: ActivityRule,
    operator: string
  ): ProcessingRecord {
    const { points, boundaryInfo } = this.calculatePoints(receipt, member, activityRule);

    const auditTrail: AuditTrail = {
      operationType: OperationType.BATCH_CREATED,
      operator,
      reason: '批次导入创建记录',
      timestamp: new Date(),
      newStatus: RecordStatus.PENDING
    };

    const record: ProcessingRecord = {
      id: dataStore.generateId(),
      batchId,
      receiptNo: receipt.receiptNo,
      memberId: member.memberId,
      memberLevel: member.level,
      transactionTime: receipt.transactionTime,
      totalAmount: receipt.totalAmount,
      activityCode: activityRule.activityCode,
      activityName: activityRule.activityName,
      calculatedPoints: points,
      status: RecordStatus.PENDING,
      isReturn: receipt.isReturn,
      originalReceiptNo: receipt.originalReceiptNo,
      boundaryInfo,
      auditTrail: [auditTrail],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    dataStore.saveProcessingRecord(record);
    this.logOperation(record.id, batchId, OperationType.BATCH_CREATED, operator, '批次导入创建记录', boundaryInfo);

    return record;
  }

  private calculatePoints(
    receipt: Receipt,
    member: Member,
    activityRule: ActivityRule
  ): { points: number; boundaryInfo?: BoundaryInfo } {
    let boundaryInfo: BoundaryInfo | undefined;

    if (receipt.isReturn) {
      boundaryInfo = {
        type: BoundaryType.RETURN_REVERSAL,
        description: '退货冲正记录',
        detail: `小票${receipt.receiptNo}为退货单，关联原小票${receipt.originalReceiptNo}，积分将反向计算`,
        suggestion: '请核对退货商品与原购买商品是否一致，确认后放行'
      };
      const points = Math.ceil(receipt.totalAmount * activityRule.pointMultiplier * -1);
      return { points, boundaryInfo };
    }

    const existingRecord = dataStore.getProcessingRecordByReceiptNo(receipt.receiptNo);
    if (existingRecord) {
      boundaryInfo = {
        type: BoundaryType.DUPLICATE_REIMPORT,
        description: '重复补录提醒',
        detail: `小票${receipt.receiptNo}已于${existingRecord.createdAt.toLocaleString()}处理过，当前状态：${existingRecord.status}`,
        suggestion: '请确认是否为重复提交，如确需补录请标记后重新处理'
      };
      const points = 0;
      return { points, boundaryInfo };
    }

    const isInTime = receipt.transactionTime >= activityRule.startTime && 
                     receipt.transactionTime <= activityRule.endTime;
    if (!isInTime) {
      boundaryInfo = {
        type: BoundaryType.TIME_BOUNDARY,
        description: '交易时间不在活动期内',
        detail: `交易时间${receipt.transactionTime.toLocaleString()}不在活动时间(${activityRule.startTime.toLocaleString()}~${activityRule.endTime.toLocaleString()})范围内`,
        suggestion: '请核实交易时间或调整活动档期'
      };
      return { points: 0, boundaryInfo };
    }

    const isStoreApplicable = activityRule.applicableStores.includes(receipt.storeCode);
    if (!isStoreApplicable) {
      boundaryInfo = {
        type: BoundaryType.TIME_BOUNDARY,
        description: '门店不参与此活动',
        detail: `门店${receipt.storeCode}不在活动门店列表中`,
        suggestion: '请核实门店编码或调整活动范围'
      };
      return { points: 0, boundaryInfo };
    }

    const isLevelApplicable = activityRule.applicableLevels.includes(member.level);
    if (!isLevelApplicable) {
      boundaryInfo = {
        type: BoundaryType.LEVEL_BOUNDARY,
        description: '会员等级不满足活动要求',
        detail: `会员等级${member.level}不在活动等级列表${activityRule.applicableLevels.join(',')}中`,
        suggestion: '请核实会员等级或调整活动门槛'
      };
      return { points: 0, boundaryInfo };
    }

    if (receipt.totalAmount < activityRule.minAmount) {
      boundaryInfo = {
        type: BoundaryType.AMOUNT_BOUNDARY,
        description: '消费金额未达活动门槛',
        detail: `消费金额${receipt.totalAmount}元低于活动最低要求${activityRule.minAmount}元`,
        suggestion: '请核实消费金额，如为拆分单请合并后重新提交'
      };
      return { points: 0, boundaryInfo };
    }

    let points = Math.ceil(receipt.totalAmount * activityRule.pointMultiplier);
    
    if (points > activityRule.maxPointsPerReceipt) {
      boundaryInfo = {
        type: BoundaryType.MULTIPLIER_BOUNDARY,
        description: '积分触发上限规则',
        detail: `计算积分${points}超过单票上限${activityRule.maxPointsPerReceipt}，已按上限封顶`,
        suggestion: '如为大额订单请核实是否需要特殊审批'
      };
      points = activityRule.maxPointsPerReceipt;
    }

    return { points, boundaryInfo };
  }

  approveRecord(recordId: string, operator: string, reason: string): ProcessingRecord {
    const record = dataStore.getProcessingRecord(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    const oldStatus = record.status;
    record.status = RecordStatus.APPROVED;
    record.updatedAt = new Date();
    record.auditTrail.push({
      operationType: OperationType.RECORD_APPROVED,
      operator,
      reason,
      timestamp: new Date(),
      oldStatus,
      newStatus: RecordStatus.APPROVED
    });

    dataStore.saveProcessingRecord(record);
    this.logOperation(recordId, record.batchId, OperationType.RECORD_APPROVED, operator, reason, record.boundaryInfo);

    return record;
  }

  rejectRecord(recordId: string, operator: string, reason: string): ProcessingRecord {
    const record = dataStore.getProcessingRecord(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    const oldStatus = record.status;
    record.status = RecordStatus.REJECTED;
    record.updatedAt = new Date();
    record.auditTrail.push({
      operationType: OperationType.RECORD_REJECTED,
      operator,
      reason,
      timestamp: new Date(),
      oldStatus,
      newStatus: RecordStatus.REJECTED
    });

    dataStore.saveProcessingRecord(record);
    this.logOperation(recordId, record.batchId, OperationType.RECORD_REJECTED, operator, reason, record.boundaryInfo);

    return record;
  }

  returnRecord(recordId: string, operator: string, reason: string): ProcessingRecord {
    const record = dataStore.getProcessingRecord(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    const oldStatus = record.status;
    record.status = RecordStatus.RETURNED;
    record.updatedAt = new Date();
    record.auditTrail.push({
      operationType: OperationType.RECORD_RETURNED,
      operator,
      reason,
      timestamp: new Date(),
      oldStatus,
      newStatus: RecordStatus.RETURNED
    });

    dataStore.saveProcessingRecord(record);
    this.logOperation(recordId, record.batchId, OperationType.RECORD_RETURNED, operator, reason, record.boundaryInfo);

    return record;
  }

  reimportRecord(
    recordId: string,
    receipt: Receipt,
    member: Member,
    activityRule: ActivityRule,
    operator: string,
    reason: string
  ): ProcessingRecord {
    const record = dataStore.getProcessingRecord(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    const { points, boundaryInfo } = this.calculatePoints(receipt, member, activityRule);
    
    const oldStatus = record.status;
    record.calculatedPoints = points;
    record.boundaryInfo = boundaryInfo;
    record.status = RecordStatus.PENDING;
    record.updatedAt = new Date();
    record.auditTrail.push({
      operationType: OperationType.RECORD_REIMPORTED,
      operator,
      reason,
      timestamp: new Date(),
      oldStatus,
      newStatus: RecordStatus.PENDING
    });

    dataStore.saveProcessingRecord(record);
    this.logOperation(recordId, record.batchId, OperationType.RECORD_REIMPORTED, operator, reason, boundaryInfo);

    return record;
  }

  private logOperation(
    recordId: string,
    batchId: string,
    operationType: OperationType,
    operator: string,
    reason: string,
    boundaryInfo?: BoundaryInfo
  ): void {
    const detail = boundaryInfo 
      ? `${reason}。边界说明：${boundaryInfo.description} - ${boundaryInfo.detail}`
      : reason;
    
    dataStore.addOperationLog({
      recordId,
      batchId,
      operationType,
      operator,
      reason,
      detail
    });
  }

  getRecordAuditTrail(recordId: string): AuditTrail[] {
    const record = dataStore.getProcessingRecord(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }
    return record.auditTrail;
  }

  getBoundaryExplanation(recordId: string): string {
    const record = dataStore.getProcessingRecord(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    if (!record.boundaryInfo) {
      return '该记录无特殊边界情况，按正常规则处理。';
    }

    const { type, description, detail, suggestion } = record.boundaryInfo;
    const typeNames: Record<BoundaryType, string> = {
      [BoundaryType.RETURN_REVERSAL]: '退货冲正',
      [BoundaryType.MULTIPLIER_BOUNDARY]: '倍率边界',
      [BoundaryType.DUPLICATE_REIMPORT]: '重复补录',
      [BoundaryType.AMOUNT_BOUNDARY]: '金额边界',
      [BoundaryType.TIME_BOUNDARY]: '时间边界',
      [BoundaryType.LEVEL_BOUNDARY]: '等级边界'
    };

    let explanation = `【${typeNames[type]}】${description}\n`;
    explanation += `详细说明：${detail}\n`;
    if (suggestion) {
      explanation += `处理建议：${suggestion}`;
    }

    return explanation;
  }

  getDecisionExplanation(recordId: string): string {
    const record = dataStore.getProcessingRecord(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    const statusNames: Record<RecordStatus, string> = {
      [RecordStatus.PENDING]: '待处理',
      [RecordStatus.APPROVED]: '已放行',
      [RecordStatus.REJECTED]: '已拒绝',
      [RecordStatus.RETURNED]: '退回修改',
      [RecordStatus.REVERSED]: '已冲正'
    };

    let explanation = `小票 ${record.receiptNo} 当前状态：${statusNames[record.status]}\n`;
    explanation += `\n=== 基本信息 ===\n`;
    explanation += `会员ID：${record.memberId}\n`;
    explanation += `会员等级：${record.memberLevel}\n`;
    explanation += `交易时间：${record.transactionTime.toLocaleString()}\n`;
    explanation += `交易金额：${record.totalAmount}元\n`;
    explanation += `活动名称：${record.activityName}\n`;
    explanation += `计算积分：${record.calculatedPoints}\n`;

    if (record.boundaryInfo) {
      explanation += `\n=== 边界情况说明 ===\n`;
      explanation += this.getBoundaryExplanation(recordId);
    }

    explanation += `\n=== 处理轨迹 ===\n`;
    record.auditTrail.forEach((trail, index) => {
      explanation += `${index + 1}. ${trail.timestamp.toLocaleString()} - ${trail.operator}\n`;
      explanation += `   操作：${trail.operationType}\n`;
      explanation += `   原因：${trail.reason}\n`;
      if (trail.oldStatus && trail.newStatus) {
        explanation += `   状态变更：${trail.oldStatus} → ${trail.newStatus}\n`;
      }
    });

    return explanation;
  }
}

export default new RecordService();
