import { importRowSchema } from '../validation/schemas';
import { dataStore, statusTransitionRules, remarkableTypes } from '../store';
import { ImportRow, ImportResult, ReplenishmentAbnormal, ReplenishmentAbnormalStatus, StatusHistoryItem } from '../types';

function getFieldSuggestion(fieldName: string): string {
  const suggestions: Record<string, string> = {
    abnormalNo: '请检查异常单号格式，应为RA开头加8位数字（如RA20240001）',
    machineId: '请从设备管理系统获取正确的机器ID',
    machineName: '请填写与机器ID对应的完整机器名称',
    pointId: '请从点位管理系统获取正确的点位ID',
    pointName: '请填写与点位ID对应的完整点位名称',
    pointAddress: '请填写点位的详细地址，便于一线同事定位',
    channelNo: '请填写正确的货道编号（如A01、B05等）',
    channelName: '请填写货道的完整名称，包含位置信息',
    productSku: '请从商品库获取正确的商品SKU编码',
    productName: '请填写与商品SKU对应的完整商品名称',
    abnormalType: '请选择以下类型之一: channel_misplacement, replenishment_diff_inconsistency, stock_shortage, machine_fault, network_abnormal, other',
    abnormalTypeDesc: '请填写异常类型的详细描述，便于同事理解',
    abnormalStatus: '请选择以下状态之一: pending, processing, remarked, suspended, resolved, closed',
    expectedQty: '请填写大于等于0的整数数量',
    actualQty: '请填写大于等于0的整数数量',
    diffQty: '请填写期望数量与实际数量的差值',
    replenishmentTime: '请使用正确的日期格式（如2024-01-15T14:30:00）',
    operatorId: '请填写操作人的员工ID',
    operatorName: '请填写操作人的真实姓名'
  };
  return suggestions[fieldName] || '请检查该字段的格式和内容是否符合要求';
}

function validateAndTransformRow(row: ImportRow): { valid: boolean; data?: ReplenishmentAbnormal; error?: { reason: string; suggestion: string } } {
  const { error, value } = importRowSchema.validate(row, { abortEarly: false });

  if (error) {
    const fieldErrors = error.details.map(d => d.message).join('; ');
    const firstField = error.details[0]?.path[0] as string;
    return {
      valid: false,
      error: {
        reason: `字段验证失败: ${fieldErrors}`,
        suggestion: getFieldSuggestion(firstField)
      }
    };
  }

  if (dataStore.exists(value.abnormalNo)) {
    return {
      valid: false,
      error: {
        reason: `异常单号 ${value.abnormalNo} 已存在，不允许重复导入`,
        suggestion: '请检查异常单号是否正确，如确需更新请使用更新接口'
      }
    };
  }

  if (value.abnormalStatus === ReplenishmentAbnormalStatus.REMARKED) {
    if (!remarkableTypes.includes(value.abnormalType)) {
      return {
        valid: false,
        error: {
          reason: `异常类型 ${value.abnormalType} 不允许直接设置为已备注状态`,
          suggestion: '只有货道错放和补货差异不一致类型的异常才能人工备注后推进'
        }
      };
    }
  }

  if (value.abnormalStatus !== ReplenishmentAbnormalStatus.PENDING) {
    if (value.abnormalStatus === ReplenishmentAbnormalStatus.RESOLVED) {
      const allowedFrom = [
        ReplenishmentAbnormalStatus.PENDING,
        ReplenishmentAbnormalStatus.PROCESSING,
        ReplenishmentAbnormalStatus.REMARKED,
        ReplenishmentAbnormalStatus.SUSPENDED
      ];
      if (!allowedFrom.includes(ReplenishmentAbnormalStatus.PENDING)) {
        return {
          valid: false,
          error: {
            reason: `状态流转不合法: 不能直接创建已解决状态的记录`,
            suggestion: '请从待处理状态开始，按照流程逐步推进'
          }
        };
      }
    }
    if (value.abnormalStatus === ReplenishmentAbnormalStatus.CLOSED) {
      return {
        valid: false,
        error: {
          reason: `状态流转不合法: 不能直接创建已关闭状态的记录`,
          suggestion: '请从待处理状态开始，按照流程逐步推进'
        }
      };
    }
  }

  const now = new Date();
  const statusHistory: StatusHistoryItem[] = [{
    status: value.abnormalStatus,
    operatorId: value.operatorId,
    operatorName: value.operatorName,
    remark: value.remark || '初始创建',
    operatedAt: now
  }];

  const transformed: ReplenishmentAbnormal = {
    ...value,
    id: `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    replenishmentTime: new Date(value.replenishmentTime),
    statusHistory,
    createdAt: now,
    updatedAt: now
  };

  return { valid: true, data: transformed };
}

export function importAbnormalRecords(rows: ImportRow[]): ImportResult {
  const successItems: ReplenishmentAbnormal[] = [];
  const failedItems: { rowData: ImportRow; reason: string; suggestion: string }[] = [];

  for (const row of rows) {
    const result = validateAndTransformRow(row);
    if (result.valid && result.data) {
      dataStore.add(result.data);
      successItems.push(result.data);
    } else if (result.error) {
      failedItems.push({
        rowData: { ...row },
        reason: result.error.reason,
        suggestion: result.error.suggestion
      });
    }
  }

  return {
    success: successItems.length,
    failed: failedItems.length,
    total: rows.length,
    successItems,
    failedItems
  };
}
