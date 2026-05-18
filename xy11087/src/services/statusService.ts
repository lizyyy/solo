import { dataStore, statusTransitionRules, remarkableTypes } from '../store';
import { ReplenishmentAbnormalStatus, AddRemarkRequest } from '../types';

export function updateAbnormalStatus(
  abnormalNo: string,
  targetStatus: ReplenishmentAbnormalStatus,
  operatorId: string,
  operatorName: string,
  remark?: string
) {
  const record = dataStore.get(abnormalNo);
  if (!record) {
    return {
      success: false,
      error: `异常记录 ${abnormalNo} 不存在`
    };
  }

  const currentStatus = record.abnormalStatus;
  const allowedTransitions = statusTransitionRules.get(currentStatus) || [];

  if (!allowedTransitions.includes(targetStatus)) {
    return {
      success: false,
      error: `状态流转不合法: 不能从 ${currentStatus} 直接流转到 ${targetStatus}`,
      allowedTransitions
    };
  }

  const updated = dataStore.update(abnormalNo, {
    abnormalStatus: targetStatus,
    updatedAt: new Date(),
    statusHistory: [
      ...record.statusHistory,
      {
        status: targetStatus,
        operatorId,
        operatorName,
        remark: remark || '状态更新',
        operatedAt: new Date()
      }
    ]
  });

  return {
    success: true,
    data: updated
  };
}

export function addRemarkAndContinue(request: AddRemarkRequest) {
  const { abnormalNo, remark, operatorId, operatorName } = request;
  const record = dataStore.get(abnormalNo);

  if (!record) {
    return {
      success: false,
      error: `异常记录 ${abnormalNo} 不存在`
    };
  }

  if (!remarkableTypes.includes(record.abnormalType)) {
    return {
      success: false,
      error: `异常类型 ${record.abnormalType} 不允许通过备注推进，只有货道错放和补货差异不一致类型可以`,
      allowedTypes: remarkableTypes
    };
  }

  if (record.abnormalStatus !== ReplenishmentAbnormalStatus.PENDING &&
      record.abnormalStatus !== ReplenishmentAbnormalStatus.PROCESSING) {
    return {
      success: false,
      error: `当前状态 ${record.abnormalStatus} 不允许通过备注推进`
    };
  }

  const updated = dataStore.update(abnormalNo, {
    abnormalStatus: ReplenishmentAbnormalStatus.REMARKED,
    remark,
    updatedAt: new Date(),
    statusHistory: [
      ...record.statusHistory,
      {
        status: ReplenishmentAbnormalStatus.REMARKED,
        operatorId,
        operatorName,
        remark,
        operatedAt: new Date()
      }
    ]
  });

  return {
    success: true,
    data: updated
  };
}

export function getAllRecords() {
  return dataStore.getAll();
}

export function getRecord(abnormalNo: string) {
  return dataStore.get(abnormalNo);
}

export function clearAllRecords() {
  dataStore.clear();
}
