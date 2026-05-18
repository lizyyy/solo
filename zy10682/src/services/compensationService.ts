import { store } from '../store';
import {
  CompensationStatus,
  HistoryAction,
  CreateCompensationRequest,
  UpdateCompensationRequest,
  ApprovalRequest,
  QueryParams,
  CompensationRecord,
  HistoryRecord
} from '../types';

export class BusinessError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'BusinessError';
  }
}

export class CompensationService {
  create(request: CreateCompensationRequest): CompensationRecord {
    this.validateCreateRequest(request);

    const existingRecords = store.findByMemberAndBatch(request.memberId, request.expiryBatchId);

    const hasConsumedRecord = existingRecords.some(r => r.isConsumed);
    if (hasConsumedRecord) {
      throw new BusinessError(
        'CONSUMED_RECORD_EXISTS',
        `该会员在批次 ${request.expiryBatchNo} 的补偿积分已被消费，无法重复申请`
      );
    }

    const hasActiveApplying = existingRecords.some(r => r.status === CompensationStatus.APPLYING);
    if (hasActiveApplying) {
      throw new BusinessError(
        'DUPLICATE_APPLICATION',
        `该会员在批次 ${request.expiryBatchNo} 已有申请在审核中`
      );
    }

    return store.createCompensation(request);
  }

  update(id: string, request: UpdateCompensationRequest, operatorId: string, operatorName: string): CompensationRecord {
    const compensation = store.getCompensation(id);
    if (!compensation) {
      throw new BusinessError('NOT_FOUND', '补偿记录不存在');
    }

    if (compensation.isConsumed) {
      throw new BusinessError('ALREADY_CONSUMED', '补偿积分已被消费，无法修改');
    }

    if (compensation.status !== CompensationStatus.APPLYING) {
      throw new BusinessError('INVALID_STATUS', '仅申请中状态可修改');
    }

    const beforeSnapshot = { ...compensation };
    const updated = store.updateCompensation(id, {
      ...(request.reason !== undefined && { reason: request.reason }),
      ...(request.compensationPoints !== undefined && { compensationPoints: request.compensationPoints })
    })!;

    store.addHistory({
      compensationId: id,
      action: HistoryAction.UPDATED,
      operatorId,
      operatorName,
      comment: '修改补偿申请',
      beforeSnapshot,
      afterSnapshot: { ...updated }
    });

    return updated;
  }

  approve(id: string, request: ApprovalRequest): CompensationRecord {
    const compensation = store.getCompensation(id);
    if (!compensation) {
      throw new BusinessError('NOT_FOUND', '补偿记录不存在');
    }

    if (compensation.isConsumed) {
      throw new BusinessError('ALREADY_CONSUMED', '补偿积分已被消费，无法审核');
    }

    if (compensation.status !== CompensationStatus.APPLYING) {
      throw new BusinessError('INVALID_STATUS', '仅申请中状态可审核');
    }

    const beforeSnapshot = { ...compensation };
    const newStatus = request.approved ? CompensationStatus.COMPENSATED : CompensationStatus.REJECTED;

    const updated = store.updateCompensation(id, {
      status: newStatus,
      approverId: request.approverId,
      approverName: request.approverName,
      approvalComment: request.comment,
      approvedAt: new Date().toISOString()
    })!;

    store.addHistory({
      compensationId: id,
      action: request.approved ? HistoryAction.APPROVED : HistoryAction.REJECTED,
      operatorId: request.approverId,
      operatorName: request.approverName,
      comment: request.comment,
      beforeSnapshot,
      afterSnapshot: { ...updated }
    });

    return updated;
  }

  withdraw(id: string, operatorId: string, operatorName: string, reason: string): CompensationRecord {
    const compensation = store.getCompensation(id);
    if (!compensation) {
      throw new BusinessError('NOT_FOUND', '补偿记录不存在');
    }

    if (compensation.isConsumed) {
      throw new BusinessError('ALREADY_CONSUMED', '补偿积分已被消费，无法撤回');
    }

    if (compensation.status !== CompensationStatus.APPLYING) {
      throw new BusinessError('INVALID_STATUS', '仅申请中状态可撤回');
    }

    const beforeSnapshot = { ...compensation };
    const updated = store.updateCompensation(id, {
      status: CompensationStatus.WITHDRAWN
    })!;

    store.addHistory({
      compensationId: id,
      action: HistoryAction.WITHDRAWN,
      operatorId,
      operatorName,
      comment: reason,
      beforeSnapshot,
      afterSnapshot: { ...updated }
    });

    return updated;
  }

  get(id: string): CompensationRecord | undefined {
    return store.getCompensation(id);
  }

  list(params: QueryParams) {
    return store.listCompensations(params);
  }

  getHistory(id: string): HistoryRecord[] {
    return store.getHistories(id);
  }

  export(params: QueryParams): CompensationRecord[] {
    const result = store.listCompensations({ ...params, page: 1, pageSize: 10000 });
    return result.data;
  }

  markConsumed(id: string, operatorId: string, operatorName: string): CompensationRecord {
    const compensation = store.getCompensation(id);
    if (!compensation) {
      throw new BusinessError('NOT_FOUND', '补偿记录不存在');
    }

    if (compensation.status !== CompensationStatus.COMPENSATED) {
      throw new BusinessError('INVALID_STATUS', '仅已补偿状态可标记消费');
    }

    if (compensation.isConsumed) {
      throw new BusinessError('ALREADY_CONSUMED', '补偿积分已被消费');
    }

    const beforeSnapshot = { ...compensation };
    const updated = store.updateCompensation(id, {
      isConsumed: true,
      consumedAt: new Date().toISOString()
    })!;

    store.addHistory({
      compensationId: id,
      action: HistoryAction.CONSUMED,
      operatorId,
      operatorName,
      comment: '补偿积分已被消费',
      beforeSnapshot,
      afterSnapshot: { ...updated }
    });

    return updated;
  }

  private validateCreateRequest(request: CreateCompensationRequest): void {
    if (!request.memberId.trim()) {
      throw new BusinessError('INVALID_MEMBER_ID', '会员ID不能为空');
    }
    if (!request.memberName.trim()) {
      throw new BusinessError('INVALID_MEMBER_NAME', '会员姓名不能为空');
    }
    if (!request.memberPhone.trim()) {
      throw new BusinessError('INVALID_MEMBER_PHONE', '会员手机号不能为空');
    }
    if (!request.expiryBatchId.trim()) {
      throw new BusinessError('INVALID_BATCH_ID', '过期批次ID不能为空');
    }
    if (request.expiryPoints <= 0) {
      throw new BusinessError('INVALID_EXPIRY_POINTS', '过期积分数必须大于0');
    }
    if (request.compensationPoints <= 0) {
      throw new BusinessError('INVALID_COMPENSATION_POINTS', '补偿积分数必须大于0');
    }
    if (request.compensationPoints > request.expiryPoints) {
      throw new BusinessError('COMPENSATION_EXCEEDS_EXPIRY', '补偿积分数不能超过过期积分数');
    }
    if (!request.reason.trim()) {
      throw new BusinessError('INVALID_REASON', '补偿理由不能为空');
    }
  }
}

export const compensationService = new CompensationService();
